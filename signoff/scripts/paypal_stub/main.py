"""Run the PayPal stub: `python -m scripts.paypal_stub.main`."""

import os

import uvicorn

from scripts.paypal_stub.app import create_stub_app


def main() -> None:
    if os.environ.get("APP_ENV", "local").lower() == "prod":
        raise SystemExit("PayPal stub cannot start when APP_ENV=prod")
    uvicorn.run(
        create_stub_app(),
        host=os.environ.get("STUB_HOST", "127.0.0.1"),
        port=int(os.environ.get("STUB_PORT", "4010")),
    )


if __name__ == "__main__":
    main()
