"""Generate a credential for MERCHANT_PASSWORD_HASH without storing or echoing the password."""

from getpass import getpass

from agent.app.auth import hash_password


def main() -> None:
    password = getpass("Owner password (12+ characters): ")
    confirmation = getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match; no credential generated")
    try:
        encoded = hash_password(password)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    print("Store this credential securely as MERCHANT_PASSWORD_HASH; never commit it:")
    print(encoded)


if __name__ == "__main__":
    main()
