"""Restricted Web Push transport. Never expose subscription endpoints in errors/logs."""

import base64
import ipaddress
import json
import socket
from typing import Any
from urllib.parse import urlsplit

from cryptography.hazmat.primitives.asymmetric import ec
from pywebpush import WebPushException, webpush  # type: ignore[import-untyped]
from requests import Response
from requests import Session as HttpSession

from agent.app.settings import Settings

PUSH_PATHS = {
    'fcm.googleapis.com': ('/fcm/send/', '/wp/'),
    'updates.push.services.mozilla.com': ('/wpush/v2/',),
    'web.push.apple.com': ('/',),
}


def validate_endpoint(endpoint: str) -> str:
    """Exact trusted authorities only, with no userinfo/port/fragment/redirects."""
    try:
        parsed = urlsplit(endpoint)
        prefixes = PUSH_PATHS.get(parsed.hostname or '', ())
        valid = (len(endpoint) <= 2048 and parsed.scheme == 'https' and parsed.username is None
                 and parsed.password is None and parsed.port in (None, 443) and not parsed.fragment
                 and parsed.netloc in {parsed.hostname, f'{parsed.hostname}:443'}
                 and bool(prefixes) and any(parsed.path.startswith(prefix) for prefix in prefixes))
    except ValueError:
        valid = False
    if not valid:
        raise ValueError('Unsupported push service address')
    return endpoint


def decode_key(value: str) -> bytes:
    try:
        return base64.b64decode(value + '=' * (-len(value) % 4), altchars=b'-_', validate=True)
    except (ValueError, TypeError) as exc:
        raise ValueError('Invalid push subscription key') from exc


def validate_keys(p256dh: str, auth: str) -> None:
    try:
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), decode_key(p256dh))
        if len(decode_key(auth)) != 16:
            raise ValueError('Invalid auth length')
    except ValueError as exc:
        raise ValueError('Invalid push subscription key') from exc


def configured(settings: Settings) -> bool:
    return bool(settings.web_push_vapid_public_key and settings.web_push_vapid_private_key
                and settings.web_push_vapid_subject.startswith(('mailto:', 'https://')))


class RestrictedPushSession(HttpSession):
    # requests accepts a heterogeneous keyword interface; isolate its Any boundary here.
    def post(self, url: str, **kwargs: Any) -> Response:  # type: ignore[override]
        validate_endpoint(url)
        host = urlsplit(url).hostname
        addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
            raise ValueError('Push service address is not public')
        kwargs['allow_redirects'] = False
        return super().post(url, **kwargs)


def send_push(settings: Settings, endpoint: str, p256dh: str, auth: str,
              notification_id: str, dispute_id: str) -> int:
    """Return only HTTP status; raw provider bodies never enter application state."""
    validate_endpoint(endpoint)
    validate_keys(p256dh, auth)
    # No buyer text, payment amounts, bearer tokens or external click destinations.
    payload = json.dumps({'title': 'Signoff', 'body': 'A dispute needs your review',
                          'notificationId': notification_id, 'disputeId': dispute_id})
    with RestrictedPushSession() as transport:
        try:
            response = webpush(
                subscription_info={'endpoint': endpoint, 'keys': {'p256dh': p256dh, 'auth': auth}},
                data=payload, vapid_private_key=settings.web_push_vapid_private_key,
                vapid_claims={'sub': settings.web_push_vapid_subject},
                timeout=10, ttl=3600, requests_session=transport,
            )
        except WebPushException as exc:
            if exc.response is not None:
                return int(exc.response.status_code)
            raise ValueError('Push transport failed') from None
    return int(response.status_code)
