"""Append-only database triggers for safety-critical tables.

Prevents UPDATE and DELETE mutations on decisions and ledger_events tables,
ensuring tamper resistance and append-only invariants at the database engine level.

Note: A database owner or superuser could disable or drop these triggers;
this is accepted for demo environments per step 03 specification.
"""

from sqlalchemy import Connection, Engine, text

POSTGRES_TRIGGER_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION reject_append_only_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Table % is append-only: UPDATE and DELETE operations are prohibited', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
"""

POSTGRES_DECISIONS_TRIGGER_SQL = """
DROP TRIGGER IF EXISTS reject_decisions_mutation ON decisions;
CREATE TRIGGER reject_decisions_mutation
BEFORE UPDATE OR DELETE ON decisions
FOR EACH ROW
EXECUTE FUNCTION reject_append_only_mutation();
"""

POSTGRES_LEDGER_EVENTS_TRIGGER_SQL = """
DROP TRIGGER IF EXISTS reject_ledger_events_mutation ON ledger_events;
CREATE TRIGGER reject_ledger_events_mutation
BEFORE UPDATE OR DELETE ON ledger_events
FOR EACH ROW
EXECUTE FUNCTION reject_append_only_mutation();
"""

SQLITE_TRIGGERS_SQL = [
    """
    CREATE TRIGGER IF NOT EXISTS reject_decisions_update BEFORE UPDATE ON decisions
    BEGIN
        SELECT RAISE(ABORT, 'Table decisions is append-only: UPDATE and DELETE operations are prohibited');
    END;
    """,
    """
    CREATE TRIGGER IF NOT EXISTS reject_decisions_delete BEFORE DELETE ON decisions
    BEGIN
        SELECT RAISE(ABORT, 'Table decisions is append-only: UPDATE and DELETE operations are prohibited');
    END;
    """,
    """
    CREATE TRIGGER IF NOT EXISTS reject_ledger_events_update BEFORE UPDATE ON ledger_events
    BEGIN
        SELECT RAISE(ABORT, 'Table ledger_events is append-only: UPDATE and DELETE operations are prohibited');
    END;
    """,
    """
    CREATE TRIGGER IF NOT EXISTS reject_ledger_events_delete BEFORE DELETE ON ledger_events
    BEGIN
        SELECT RAISE(ABORT, 'Table ledger_events is append-only: UPDATE and DELETE operations are prohibited');
    END;
    """,
]


def install_append_only_triggers(target: Engine | Connection) -> None:
    """Install append-only mutation triggers on target database."""

    def _execute_on_conn(conn: Connection) -> None:
        dialect = conn.dialect.name
        if dialect == "postgresql":
            conn.execute(text(POSTGRES_TRIGGER_FUNCTION_SQL))
            conn.execute(text(POSTGRES_DECISIONS_TRIGGER_SQL))
            conn.execute(text(POSTGRES_LEDGER_EVENTS_TRIGGER_SQL))
        elif dialect == "sqlite":
            for trigger_sql in SQLITE_TRIGGERS_SQL:
                conn.execute(text(trigger_sql))

    if isinstance(target, Engine):
        with target.begin() as conn:
            _execute_on_conn(conn)
    else:
        _execute_on_conn(target)
