"""Create (or find) the PayPal webhook subscription for this deployment.

Usage: python -m scripts.register_webhook
Requires PAYPAL_ENV=sandbox and PUBLIC_BASE_URL set to the public HTTPS origin.
Prints only the webhook id; copy it into PAYPAL_WEBHOOK_ID.
"""

import httpx

from agent.app.settings import PayPalEnv, Settings

EVENTS = (
    "CUSTOMER.DISPUTE.CREATED",
    "CUSTOMER.DISPUTE.UPDATED",
    "CUSTOMER.DISPUTE.RESOLVED",
)


def main() -> None:
    settings = Settings()
    if settings.paypal_env != PayPalEnv.sandbox:
        raise SystemExit("register_webhook requires PAYPAL_ENV=sandbox")
    webhook_url = f"{settings.public_base_url.rstrip('/')}/webhooks/paypal"
    if not webhook_url.startswith("https://"):
        raise SystemExit("PUBLIC_BASE_URL must be the public HTTPS tunnel URL")

    token = httpx.post(
        f"{settings.paypal_base_url.rstrip('/')}/v1/oauth2/token",
        auth=(settings.paypal_client_id, settings.paypal_client_secret),
        data={"grant_type": "client_credentials"},
        timeout=30,
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    base = f"{settings.paypal_base_url.rstrip('/')}/v1/notifications/webhooks"

    existing = httpx.get(base, headers=headers, timeout=30).json().get("webhooks", [])
    match = next((hook for hook in existing if hook.get("url") == webhook_url), None)
    if match is None:
        match = httpx.post(
            base,
            headers=headers,
            json={"url": webhook_url, "event_types": [{"name": name} for name in EVENTS]},
            timeout=30,
        ).json()
    elif settings.paypal_webhook_id and settings.paypal_webhook_id != match["id"]:
        print(f"warning: .env PAYPAL_WEBHOOK_ID={settings.paypal_webhook_id} does not match {match['id']}")

    print(f"webhook_url={webhook_url}")
    print(f"PAYPAL_WEBHOOK_ID={match['id']}")


if __name__ == "__main__":
    main()
