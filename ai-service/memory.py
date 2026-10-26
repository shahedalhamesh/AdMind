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