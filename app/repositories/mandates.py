"""Portable SQLAlchemy Core queries for mandate data."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import Engine, text


SUMMARY_COLUMNS = """
    m.id, m.jurisdiction, m.name, m.type, m.target, m.target_category,
    m.effective_date, m.enforcement_date, m.removal_date, m.duration_days,
    m.date_uncertain, m.ongoing, m.visibility_level
"""


def _csv_values(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _add_in_clause(
    conditions: list[str],
    params: dict[str, object],
    column: str,
    prefix: str,
    values: Iterable[str],
) -> None:
    placeholders: list[str] = []
    for index, value in enumerate(values):
        key = f"{prefix}_{index}"
        placeholders.append(f":{key}")
        params[key] = value
    if placeholders:
        conditions.append(f"{column} IN ({', '.join(placeholders)})")


def list_mandates(
    engine: Engine,
    *,
    jurisdiction: str | None,
    mandate_type: str | None,
    category: str | None,
    start_date: str | None,
    end_date: str | None,
    search: str | None,
    page: int,
    page_size: int,
) -> tuple[int, list[dict[str, object]]]:
    conditions: list[str] = []
    params: dict[str, object] = {}
    _add_in_clause(
        conditions, params, "m.jurisdiction", "jurisdiction", _csv_values(jurisdiction)
    )
    _add_in_clause(conditions, params, "m.type", "type", _csv_values(mandate_type))

    categories = _csv_values(category)
    if categories:
        category_conditions: list[str] = []
        for index, value in enumerate(categories):
            key = f"category_{index}"
            category_conditions.append(f"mc.category = :{key}")
            params[key] = value
        conditions.append(
            "EXISTS (SELECT 1 FROM mandate_categories mc "
            "WHERE mc.mandate_id = m.id AND ("
            + " OR ".join(category_conditions)
            + "))"
        )

    if start_date:
        conditions.append("(m.removal_date IS NULL OR m.removal_date >= :start_date)")
        params["start_date"] = start_date
    if end_date:
        conditions.append(
            "COALESCE(m.effective_date, m.enforcement_date) <= :end_date"
        )
        params["end_date"] = end_date
    if search:
        conditions.append(
            "(LOWER(COALESCE(m.name, '')) LIKE :search "
            "OR LOWER(COALESCE(m.target, '')) LIKE :search "
            "OR LOWER(COALESCE(m.compliance, '')) LIKE :search "
            "OR LOWER(COALESCE(m.executive_orders, '')) LIKE :search)"
        )
        params["search"] = f"%{search.lower()}%"

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params["limit"] = page_size
    params["offset"] = (page - 1) * page_size

    count_query = text(f"SELECT COUNT(*) FROM mandates m {where}")
    data_query = text(
        f"""
        SELECT {SUMMARY_COLUMNS}
        FROM mandates m
        {where}
        ORDER BY COALESCE(m.effective_date, m.enforcement_date), m.jurisdiction, m.id
        LIMIT :limit OFFSET :offset
        """
    )

    with engine.connect() as connection:
        total = int(connection.execute(count_query, params).scalar_one())
        rows = [dict(row) for row in connection.execute(data_query, params).mappings()]
    return total, rows


def get_mandate(engine: Engine, mandate_id: str) -> dict[str, object] | None:
    with engine.connect() as connection:
        row = connection.execute(
            text("SELECT * FROM mandates WHERE id = :mandate_id"),
            {"mandate_id": mandate_id},
        ).mappings().first()
    return dict(row) if row else None


def search_mandates(
    engine: Engine, q: str, jurisdiction: str | None
) -> list[dict[str, object]]:
    conditions = [
        "(LOWER(COALESCE(m.name, '')) LIKE :term "
        "OR LOWER(COALESCE(m.target, '')) LIKE :term "
        "OR LOWER(COALESCE(m.compliance, '')) LIKE :term "
        "OR LOWER(COALESCE(m.executive_orders, '')) LIKE :term)"
    ]
    params: dict[str, object] = {"term": f"%{q.lower()}%"}
    _add_in_clause(
        conditions, params, "m.jurisdiction", "jurisdiction", _csv_values(jurisdiction)
    )
    query = text(
        f"""
        SELECT m.id, m.jurisdiction, m.name, m.type, m.target,
               m.compliance, m.executive_orders
        FROM mandates m
        WHERE {' AND '.join(conditions)}
        ORDER BY m.jurisdiction, m.id
        """
    )
    with engine.connect() as connection:
        return [dict(row) for row in connection.execute(query, params).mappings()]


def get_stats(engine: Engine) -> dict[str, object]:
    with engine.connect() as connection:
        total = int(connection.execute(text("SELECT COUNT(*) FROM mandates")).scalar_one())
        by_jurisdiction = {
            str(row["jurisdiction"]): int(row["cnt"])
            for row in connection.execute(
                text(
                    "SELECT jurisdiction, COUNT(*) AS cnt FROM mandates "
                    "GROUP BY jurisdiction ORDER BY cnt DESC"
                )
            ).mappings()
        }
        by_type = {
            str(row["type"]): int(row["cnt"])
            for row in connection.execute(
                text(
                    "SELECT type, COUNT(*) AS cnt FROM mandates WHERE type IS NOT NULL "
                    "GROUP BY type ORDER BY cnt DESC"
                )
            ).mappings()
        }
        by_category = {
            str(row["category"]): int(row["cnt"])
            for row in connection.execute(
                text(
                    "SELECT category, COUNT(*) AS cnt FROM mandate_categories "
                    "GROUP BY category ORDER BY cnt DESC"
                )
            ).mappings()
        }
        date_range = connection.execute(
            text(
                "SELECT MIN(COALESCE(effective_date, enforcement_date)) AS earliest, "
                "MAX(COALESCE(removal_date, effective_date, enforcement_date)) AS latest "
                "FROM mandates"
            )
        ).mappings().one()
        uncertain = int(
            connection.execute(
                text("SELECT COUNT(*) FROM mandates WHERE date_uncertain = 1")
            ).scalar_one()
        )
    return {
        "total": total,
        "by_jurisdiction": by_jurisdiction,
        "by_type": by_type,
        "by_category": by_category,
        "date_range": {
            "earliest": date_range["earliest"],
            "latest": date_range["latest"],
        },
        "uncertain_dates": uncertain,
    }


def get_filters(engine: Engine) -> dict[str, list[str]]:
    with engine.connect() as connection:
        jurisdictions = list(
            connection.execute(
                text("SELECT DISTINCT jurisdiction FROM mandates ORDER BY jurisdiction")
            ).scalars()
        )
        mandate_types = list(
            connection.execute(
                text(
                    "SELECT DISTINCT type FROM mandates "
                    "WHERE type IS NOT NULL ORDER BY type"
                )
            ).scalars()
        )
        categories = list(
            connection.execute(
                text(
                    "SELECT DISTINCT category FROM mandate_categories ORDER BY category"
                )
            ).scalars()
        )
    return {
        "jurisdictions": jurisdictions,
        "types": mandate_types,
        "categories": categories,
    }


def list_notable_events(engine: Engine) -> list[dict[str, object]]:
    with engine.connect() as connection:
        return [
            dict(row)
            for row in connection.execute(
                text("SELECT * FROM notable_events ORDER BY event_date, id")
            ).mappings()
        ]


def database_record_count(engine: Engine) -> int:
    with engine.connect() as connection:
        return int(connection.execute(text("SELECT COUNT(*) FROM mandates")).scalar_one())

