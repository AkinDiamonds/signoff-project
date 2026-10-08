"""Manual smoke script for PayPal read client against sandbox environment.

Usage:
    python signoff/scripts/smoke_paypal_read.py [dispute_id]
"""

import asyncio
import sys

from agent.app.paypal.auth import PayPalAuth
from agent.app.paypal.read_client import PayPalReadClient
from agent.app.settings import Settings


async def main() -> None:
    settings = Settings()
    if not settings.paypal_client_id or not settings.paypal_client_secret:
        print("[!] PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not configured. Skipping live smoke call.")
        return

    print(f"Connecting to sandbox at {settings.paypal_base_url}...")
    auth = PayPalAuth()
    async with PayPalReadClient(auth=auth) as client:
        print("Listing disputes...")
        resp = await client.list_disputes(page_size=5)
        print(f"Found {len(resp.items)} disputes (links: {len(resp.links)})")
        for item in resp.items:
            print(
                f" - {item.dispute_id}: {item.status} ({item.reason}) "
                f"amount: {item.dispute_amount.value} {item.dispute_amount.currency_code}"
            )

        dispute_id = sys.argv[1] if len(sys.argv) > 1 else (resp.items[0].dispute_id if resp.items else None)
        if dispute_id:
            print(f"\nFetching detail for dispute {dispute_id}...")
            dispute = await client.get_dispute(dispute_id)
            print(
                f"Dispute {dispute.dispute_id} detail: "
                f"stage={dispute.dispute_life_cycle_stage}, state={dispute.dispute_state}"
            )
            print(
                f"Allowed response options: "
                f"accept_claim={dispute.allowed_response_options.accept_claim}, "
                f"make_offer={dispute.allowed_response_options.make_offer}"
            )

    print("\nSmoke check completed successfully.")


if __name__ == "__main__":
    asyncio.run(main())
