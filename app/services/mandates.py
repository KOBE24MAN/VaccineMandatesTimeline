"""Mandate response normalization and search helpers."""

from __future__ import annotations


def normalize_mandate(row: dict[str, object]) -> dict[str, object]:
    row["date_uncertain"] = bool(row.get("date_uncertain", 0))
    row["ongoing"] = bool(row.get("ongoing", 0))
    return row


def normalize_event(row: dict[str, object]) -> dict[str, object]:
    row["date_approximate"] = bool(row.get("date_approximate", 0))
    return row


def build_search_result(row: dict[str, object], query: str) -> dict[str, object]:
    snippet = None
    lowered_query = query.lower()
    for field in ("name", "target", "compliance", "executive_orders"):
        value = row.get(field)
        if isinstance(value, str) and lowered_query in value.lower():
            index = value.lower().index(lowered_query)
            start = max(0, index - 40)
            end = min(len(value), index + len(query) + 40)
            snippet = (
                ("..." if start else "")
                + value[start:end]
                + ("..." if end < len(value) else "")
            )
            break
    return {
        "id": row["id"],
        "jurisdiction": row["jurisdiction"],
        "name": row.get("name"),
        "type": row.get("type"),
        "snippet": snippet,
    }

