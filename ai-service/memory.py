"""TEMPORARY episodic memory (SQLite) for local testing only.

When the real database exists, replace the bodies of these functions
(keep the signatures) so they call Laravel/MySQL instead.
"""
import sqlite3
from contextlib import closing
from pathlib import Path

DB_PATH = Path(__file__).parent / "memory.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS episodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            client_id INTEGER NOT NULL,
            request TEXT NOT NULL,
            output TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            feedback TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            company_id INTEGER NOT NULL,
            client_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """

    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS client_profiles (
            company_id INTEGER NOT NULL,
            client_id INTEGER NOT NULL,
            client_name TEXT NOT NULL DEFAULT '',
            industry TEXT NOT NULL DEFAULT '',
            brand_tone TEXT NOT NULL DEFAULT '',
            audience TEXT NOT NULL DEFAULT '',
            platforms TEXT NOT NULL DEFAULT '',
            avoid TEXT NOT NULL DEFAULT '',
            PRIMARY KEY (company_id, client_id)
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS client_rules (
            company_id INTEGER NOT NULL,
            client_id INTEGER NOT NULL,
            rules TEXT NOT NULL DEFAULT '',
            last_episode_id INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (company_id, client_id)
        )
        """
    )
    return conn


def save_episode(company_id: int, client_id: int, request: str, output: str) -> int:
    with closing(_connect()) as conn:
        cur = conn.execute(
            "INSERT INTO episodes (company_id, client_id, request, output) "
            "VALUES (?, ?, ?, ?)",
            (company_id, client_id, request, output),
        )
        conn.commit()
        return cur.lastrowid


def add_feedback(episode_id: int, company_id: int, status: str, feedback: str) -> bool:
    """Update an episode. company_id must match, so one tenant can't touch another's."""
    with closing(_connect()) as conn:
        cur = conn.execute(
            "UPDATE episodes SET status = ?, feedback = ? "
            "WHERE id = ? AND company_id = ?",
            (status, feedback, episode_id, company_id),
        )
        conn.commit()
        return cur.rowcount > 0


def get_recent_feedback(company_id: int, client_id: int, limit: int = 5) -> str:
    """Return the last reviewed episodes for this client as plain text."""
    with closing(_connect()) as conn:
        rows = conn.execute(
            "SELECT request, status, feedback FROM episodes "
            "WHERE company_id = ? AND client_id = ? AND status != 'pending' "
            "ORDER BY id DESC LIMIT ?",
            (company_id, client_id, limit),
        ).fetchall()
    return "\n".join(
        f"- [{r['status']}] Request: {r['request']} | Feedback: {r['feedback'] or 'none'}"
        for r in rows
    )

def add_message(
    conversation_id: str, company_id: int, client_id: int, role: str, content: str
) -> None:
    with closing(_connect()) as conn:
        conn.execute(
            "INSERT INTO messages (conversation_id, company_id, client_id, role, content) "
            "VALUES (?, ?, ?, ?, ?)",
            (conversation_id, company_id, client_id, role, content),
        )
        conn.commit()


def get_conversation(conversation_id: str, company_id: int, limit: int = 10) -> str:
    """Last `limit` messages of this conversation as plain text (oldest first)."""
    with closing(_connect()) as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages "
            "WHERE conversation_id = ? AND company_id = ? "
            "ORDER BY id DESC LIMIT ?",
            (conversation_id, company_id, limit),
        ).fetchall()
    rows.reverse()
    return "\n".join(f"{r['role']}: {r['content'][:800]}" for r in rows)

PROFILE_LABELS = {
    "client_name": "Client name",
    "industry": "Industry",
    "brand_tone": "Brand tone",
    "audience": "Target audience",
    "platforms": "Platforms",
    "avoid": "Never use / avoid",
}


def save_profile(company_id: int, client_id: int, **fields: str) -> None:
    """Create or fully replace the profile of one client."""
    cols = list(PROFILE_LABELS)
    values = [fields.get(c, "") for c in cols]
    with closing(_connect()) as conn:
        conn.execute(
            f"INSERT INTO client_profiles (company_id, client_id, {', '.join(cols)}) "
            f"VALUES (?, ?, {', '.join('?' for _ in cols)}) "
            f"ON CONFLICT(company_id, client_id) DO UPDATE SET "
            f"{', '.join(f'{c} = excluded.{c}' for c in cols)}",
            (company_id, client_id, *values),
        )
        conn.commit()


def get_profile(company_id: int, client_id: int) -> str:
    """Client profile as plain text, or '' if none exists."""
    with closing(_connect()) as conn:
        row = conn.execute(
            "SELECT * FROM client_profiles WHERE company_id = ? AND client_id = ?",
            (company_id, client_id),
        ).fetchone()
    if not row:
        return ""
    return "\n".join(
        f"- {label}: {row[col]}" for col, label in PROFILE_LABELS.items() if row[col]
    ) 

def get_episode(episode_id: int, company_id: int) -> dict | None:
    """One episode (request + output), only if it belongs to this company."""
    with closing(_connect()) as conn:
        row = conn.execute(
            "SELECT client_id, request, output FROM episodes "
            "WHERE id = ? AND company_id = ?",
            (episode_id, company_id),
        ).fetchone()
    return dict(row) if row else None 

def get_rules(company_id: int, client_id: int) -> tuple[str, int]:
    """Learned style rules for a client, and the last episode they were built from."""
    with closing(_connect()) as conn:
        row = conn.execute(
            "SELECT rules, last_episode_id FROM client_rules "
            "WHERE company_id = ? AND client_id = ?",
            (company_id, client_id),
        ).fetchone()
    return (row["rules"], row["last_episode_id"]) if row else ("", 0)


def save_rules(company_id: int, client_id: int, rules: str, last_episode_id: int) -> None:
    with closing(_connect()) as conn:
        conn.execute(
            "INSERT INTO client_rules (company_id, client_id, rules, last_episode_id) "
            "VALUES (?, ?, ?, ?) "
            "ON CONFLICT(company_id, client_id) DO UPDATE SET "
            "rules = excluded.rules, last_episode_id = excluded.last_episode_id",
            (company_id, client_id, rules, last_episode_id),
        )
        conn.commit()


def get_unconsolidated_feedback(company_id: int, client_id: int) -> list[dict]:
    """Rejected episodes with a written comment, not yet merged into the rules."""
    _, last_id = get_rules(company_id, client_id)
    with closing(_connect()) as conn:
        rows = conn.execute(
            "SELECT id, feedback FROM episodes "
            "WHERE company_id = ? AND client_id = ? AND status = 'rejected' "
            "AND feedback IS NOT NULL AND feedback != '' AND id > ? ORDER BY id",
            (company_id, client_id, last_id),
        ).fetchall()
    return [dict(r) for r in rows]