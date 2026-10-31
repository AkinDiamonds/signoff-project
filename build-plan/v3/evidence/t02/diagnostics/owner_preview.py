import os
from pathlib import Path

from agent.app.settings import Settings
from scripts.test_environment import isolate_test_environment

os.environ['SIGNOFF_TEST_DATABASE_URL'] = 'postgresql+psycopg://signoff:signoff@localhost:5432/signoff_test_preview'
isolate_test_environment(os.environ)
Settings.model_config['env_file'] = None

from agent.app.auth import hash_password

password = 'fictional-preview-owner-password-123'
os.environ.update(
    APP_ENV='prod', PAYPAL_ENV='sandbox',
    PAYPAL_CLIENT_ID='fictional-preview', PAYPAL_CLIENT_SECRET='fictional-preview',
    APPROVAL_TOKEN_SECRET='fictional-preview-session-key-over-32-characters',
    STORE_API_KEY='fictional-preview-store',
    MERCHANT_EMAIL='owner@example.test', MERCHANT_PASSWORD_HASH=hash_password(password),
    ALLOWED_ORIGINS='https://merchant.signoff.test,https://merchant.signoff.test:8443',
    WEB_BASE_URL='https://merchant.signoff.test',
    PUBLIC_BASE_URL='https://api.signoff-api.test',
)

from agent.app.main import app
import uvicorn

assert app.state.settings.app_env.value == 'prod'
assert Path('signoff/agent/app/auth.py').is_file()
print('Fresh source preview: production cookie mode; isolated signoff_test_preview; no provider calls', flush=True)
uvicorn.run(app, host='127.0.0.1', port=8042, access_log=False)
