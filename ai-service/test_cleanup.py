import os

# Small limits for the test only (set before importing the modules)
os.environ["MAX_EPISODES"] = "5"
os.environ["MAX_EXAMPLES"] = "2"
os.environ["MESSAGE_DAYS"] = "30"

from contextlib import closing

import knowledge
import memory
import memory_manager as mm

C, K = 999, 1  # fake tenant used only by this test


def n(table: str, where: str = "") -> int:
    with closing(memory._connect()) as conn:
        return conn.execute(
            f"SELECT COUNT(*) FROM {table} WHERE company_id = ? AND client_id = ? {where}",
            (C, K),
        ).fetchone()[0]


def example_episodes() -> list[int]:
    points, _ = knowledge._client().scroll(
        knowledge.EXAMPLES,
        scroll_filter=knowledge._tenant_filter(C, K),
        limit=100,
        with_payload=["episode_id"],
        with_vectors=False,
    )
    return sorted(p.payload["episode_id"] for p in points)


mm.forget_client(C, K)  # start clean

# 1) Episodes cap, and a rejected comment that was not learned yet is protected
first = mm.remember_exchange(C, K, "first", "first out")
mm.remember_feedback(C, first, "rejected", "too long")
ids = [mm.remember_exchange(C, K, f"req {i}", f"out {i}") for i in range(8)]
print("episodes (expect 6 = 5 newest + 1 protected):", n("episodes"))
print("protected episode kept (expect True):", memory.get_episode(first, C) is not None)

# 2) Examples cap: approve 4, only the newest 2 stay
for ep in ids[4:]:
    mm.remember_feedback(C, ep, "approved", "ok")
print("example episodes (expect", ids[6:], "):", example_episodes())

# 3) Old chat messages are deleted
with closing(memory._connect()) as conn:
    conn.execute(
        "INSERT INTO messages (conversation_id, company_id, client_id, role, content, created_at) "
        "VALUES ('old', ?, ?, 'user', 'old msg', '2000-01-01 00:00:00')",
        (C, K),
    )
    conn.commit()
mm.remember_exchange(C, K, "x", "y", "conv1")
print("old messages left (expect 0):", n("messages", "AND content = 'old msg'"))
print("new messages (expect 2):", n("messages"))

# 4) Forget the whole client
mm.remember_document(C, K, "t", "نص تجريبي عن القهوة")
print("forget_client result:", mm.forget_client(C, K))
print(
    "left after forget (expect 0 0 0 0):",
    n("episodes"),
    n("messages"),
    len(example_episodes()),
    len(mm.list_documents(C, K)),
)