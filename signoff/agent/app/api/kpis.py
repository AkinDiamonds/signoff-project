"""KPI aggregation API endpoint for the dashboard.

Per plan/04-frontend-spec.md and Step 21:
- Open disputes: status needs seller response or approval pending.
- Dollars at risk: sum of amounts on open USD disputes.
- Recovered: sum of amounts on disputes resolved in the merchant's favor.
- Conceded: sum of amounts refunded or paid out via accepted claims/settled offers.
- Share auto-resolved: disputes closed with no human approval / closed disputes.
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

from agent.app.db.models import Approval, Decision, Dispute
from agent.app.db.session import get_db_session
from agent.app.domain.enums import ActionType, ApprovalResolution, DisputeStatus, Verdict

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
        description="Sum of amounts refunded or conceded on USD disputes"
    )
    closed_disputes: int = Field(description="Total count of closed disputes")
    auto_resolved_disputes: int = Field(
        description="Count of closed disputes resolved without human approval"
    )
    share_auto_resolved: float | None = Field(
        default=None,
        description="Proportion of closed disputes auto-resolved (null when closed disputes is 0)",
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
    decisions = list(db_session.scalars(select(Decision)).all())

    approvals_by_dispute: dict[str, list[Approval]] = {}
    for approval in approvals:
        approvals_by_dispute.setdefault(approval.dispute_id, []).append(approval)

    decisions_by_dispute: dict[str, list[Decision]] = {}
    for decision in decisions:
        decisions_by_dispute.setdefault(decision.dispute_id, []).append(decision)

    open_disputes_count = 0
    dollars_at_risk = Decimal("0.00")
    recovered = Decimal("0.00")
    conceded = Decimal("0.00")
    closed_disputes_count = 0
    auto_resolved_count = 0

    other_currency_open_disputes: dict[str, int] = {}
    non_usd_open_disputes = 0

    for dispute in disputes:
        disp_approvals = approvals_by_dispute.get(dispute.id, [])
        disp_decisions = decisions_by_dispute.get(dispute.id, [])

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

            # Check if resolved by agent vs outside agent
            # If no agent decisions exist, dispute was resolved outside the agent
            if disp_decisions:
                had_human_approval = any(
                    a.resolution in (ApprovalResolution.APPROVE.value, ApprovalResolution.EDIT.value)
                    for a in disp_approvals
                )
                if not had_human_approval:
                    auto_resolved_count += 1

            # Determine whether recovered (merchant's favor) or conceded
            snapshot = dispute.snapshot or {}
            outcome_code = (snapshot.get("dispute_outcome") or {}).get("outcome_code", "").upper()
            refund_details = snapshot.get("refund_details") or {}
            has_refund = bool(refund_details.get("allowed_refund_amount"))

            has_concession_decision = any(
                d.action_type in (ActionType.ACCEPT_CLAIM.value, ActionType.MAKE_OFFER.value)
                and d.verdict == Verdict.ALLOW.value
                for d in disp_decisions
            )
            has_concession_approval = any(
                a.resolution in (ApprovalResolution.APPROVE.value, ApprovalResolution.EDIT.value)
                for a in disp_approvals
            )

            is_conceded = (
                outcome_code in ("RESOLVED_BUYER_FAVOUR", "BUYER_FAVOUR")
                or has_refund
                or has_concession_decision
                or has_concession_approval
            )

            if is_conceded:
                if dispute.currency == "USD":
                    conceded += dispute.amount
            else:
                if dispute.currency == "USD":
                    recovered += dispute.amount

    # Edge cases: no closed disputes -> ratios are null
    share_auto_resolved: float | None = None
    estimated_hours_saved: float | None = None

    if closed_disputes_count > 0:
        share_auto_resolved = round(auto_resolved_count / closed_disputes_count, 4)
        hours = (closed_disputes_count * DEFAULT_ASSUMED_MINUTES_PER_DISPUTE) / 60.0
        estimated_hours_saved = round(hours, 2)

    return KpiResponse(
        open_disputes=open_disputes_count,
        dollars_at_risk=f"{dollars_at_risk:.2f}",
        recovered=f"{recovered:.2f}",
        conceded=f"{conceded:.2f}",
        closed_disputes=closed_disputes_count,
        auto_resolved_disputes=auto_resolved_count,
        share_auto_resolved=share_auto_resolved,
        assumed_minutes_per_dispute=DEFAULT_ASSUMED_MINUTES_PER_DISPUTE,
        estimated_hours_saved=estimated_hours_saved,
        other_currency_open_disputes=other_currency_open_disputes,
        non_usd_open_disputes=non_usd_open_disputes,
    )
