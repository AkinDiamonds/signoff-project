"""KPI aggregation API endpoint for the dashboard.

Per plan/04-frontend-spec.md and Step 21:
- Open disputes: status needs seller response or approval pending.
- Dollars at risk: sum of amounts on open USD disputes.
- Recovered/conceded: disputed amounts with explicit seller/buyer-favour outcomes.
- Auto-resolution attribution is unavailable until action-specific proof is verified.
- Estimated hours saved: closed disputes * assumed minutes each; returns assumption value.
- Edge cases:
  * No closed disputes: ratios/hours are null (None), never NaN or divide-by-zero.
  * Disputes in other currencies excluded from USD sums and counted separately.
  * Disputes resolved outside the agent are never counted as auto-resolved.
  * Money fields are strings formatted to two decimal places.
"""

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.models import Approval, Dispute
from agent.app.db.session import get_db_session
from agent.app.domain.enums import ApprovalResolution, DisputeStatus

router = APIRouter(prefix="/api/kpis", tags=["KPIs"])

DEFAULT_ASSUMED_MINUTES_PER_DISPUTE = 20


class KpiResponse(BaseModel):
    """Aggregated operational metrics for dispute management."""

    open_disputes: int = Field(
        description="Count of open disputes (waiting for seller response or pending human approval)"
    )
    dollars_at_risk: str = Field(
        description="Sum of amounts on open USD disputes formatted as a decimal string"
    )
    recovered: str = Field(
        description="Sum of amounts on USD disputes resolved in merchant's favor"
    )
    conceded: str = Field(
        description="Disputed USD amounts with an explicit buyer-favour outcome; not a payment total"
    )
    closed_disputes: int = Field(description="Total count of closed disputes")
    auto_resolved_disputes: int | None = Field(
        default=None, description="Unavailable until action-specific resolution attribution is verified"
    )
    share_auto_resolved: float | None = Field(
        default=None,
        description="Unavailable until action-specific resolution attribution is verified",
    )
    assumed_minutes_per_dispute: int = Field(
        default=DEFAULT_ASSUMED_MINUTES_PER_DISPUTE,
        description="Assumption value of minutes saved per dispute",
    )
    estimated_hours_saved: float | None = Field(
        default=None,
        description="Estimated operational hours saved (null when closed disputes is 0)",
    )
    other_currency_open_disputes: dict[str, int] = Field(
        default_factory=dict,
        description="Breakdown of open disputes in non-USD currencies",
    )
    non_usd_open_disputes: int = Field(
        default=0,
        description="Total count of open disputes in non-USD currencies",
    )


@router.get(
    "",
    response_model=KpiResponse,
    summary="Get aggregated dispute operations KPIs",
    description=(
        "Returns metrics for open disputes, dollars at risk, recovered, conceded, "
        "auto-resolution share, and estimated hours saved with explicit assumption values."
    ),
)
async def get_kpis(
    db_session: Annotated[Session, Depends(get_db_session)],
) -> KpiResponse:
    disputes = list(db_session.scalars(select(Dispute)).all())
    approvals = list(db_session.scalars(select(Approval)).all())

    approvals_by_dispute: dict[str, list[Approval]] = {}
    for approval in approvals:
        approvals_by_dispute.setdefault(approval.dispute_id, []).append(approval)

    open_disputes_count = 0
    dollars_at_risk = Decimal("0.00")
    recovered = Decimal("0.00")
    conceded = Decimal("0.00")
    closed_disputes_count = 0

    other_currency_open_disputes: dict[str, int] = {}
    non_usd_open_disputes = 0

    for dispute in disputes:
        disp_approvals = approvals_by_dispute.get(dispute.id, [])

        has_pending_approval = any(
            a.resolution == ApprovalResolution.PENDING.value for a in disp_approvals
        )
        is_closed = dispute.status == DisputeStatus.RESOLVED.value

        # Open disputes: status needs seller response or approval pending
        is_open = not is_closed and (
            dispute.status == DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value
            or has_pending_approval
        )

        if is_open:
            open_disputes_count += 1
            if dispute.currency == "USD":
                dollars_at_risk += dispute.amount
            else:
                non_usd_open_disputes += 1
                curr = dispute.currency
                other_currency_open_disputes[curr] = other_currency_open_disputes.get(curr, 0) + 1

        if is_closed:
            closed_disputes_count += 1

            # Only explicit PayPal outcome codes classify the disputed amount.
            snapshot = dispute.snapshot or {}
            outcome_code = (snapshot.get("dispute_outcome") or {}).get("outcome_code", "").upper()
            if dispute.currency == "USD":
                if outcome_code in ("RESOLVED_BUYER_FAVOUR", "BUYER_FAVOUR"):
                    conceded += dispute.amount
                elif outcome_code in ("RESOLVED_SELLER_FAVOUR", "SELLER_FAVOUR"):
                    recovered += dispute.amount

    # Edge cases: no closed disputes -> ratios are null
    share_auto_resolved: float | None = None
    estimated_hours_saved: float | None = None

    if closed_disputes_count > 0:
        hours = (closed_disputes_count * DEFAULT_ASSUMED_MINUTES_PER_DISPUTE) / 60.0
        estimated_hours_saved = round(hours, 2)

    return KpiResponse(
        open_disputes=open_disputes_count,
        dollars_at_risk=f"{dollars_at_risk:.2f}",
        recovered=f"{recovered:.2f}",
        conceded=f"{conceded:.2f}",
        closed_disputes=closed_disputes_count,
        auto_resolved_disputes=None,
        share_auto_resolved=share_auto_resolved,
        assumed_minutes_per_dispute=DEFAULT_ASSUMED_MINUTES_PER_DISPUTE,
        estimated_hours_saved=estimated_hours_saved,
        other_currency_open_disputes=other_currency_open_disputes,
        non_usd_open_disputes=non_usd_open_disputes,
    )
