"""Store adapter factory choosing between Local and HTTP implementations."""

from sqlalchemy.orm import Session

from agent.app.settings import PayPalEnv, Settings
from agent.app.store.base import StoreAdapter
from agent.app.store.http_adapter import HttpStoreAdapter
from agent.app.store.local_adapter import LocalStoreAdapter
from agent.app.store.scope import order_scope


def build_store_adapter(settings: Settings, session: Session) -> StoreAdapter:
    """Build appropriate StoreAdapter based on settings environment.

    Returns LocalStoreAdapter when running against the stub environment,
    or HttpStoreAdapter pointing to public_base_url otherwise.
    """
    if settings.paypal_env == PayPalEnv.stub:
        return LocalStoreAdapter(session, scope=order_scope(settings))
    return HttpStoreAdapter(
        base_url=settings.public_base_url,
        api_key=settings.store_api_key,
    )
