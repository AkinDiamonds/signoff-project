FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app/signoff:/app/signoff/agent

WORKDIR /app

COPY pyproject.toml README.md ./
COPY signoff ./signoff
COPY alembic.ini ./
COPY migrations ./migrations
RUN pip install .

# Every compose service supplies its own command.
