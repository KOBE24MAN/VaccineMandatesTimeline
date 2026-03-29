"""
Data validation script for mandates.db.
Checks data quality across 10 validation rules.
"""

import sqlite3
import sys
import os

VALID_JURISDICTIONS = {"WA", "NSW", "VIC", "NT", "SA", "TAS", "ACT", "QLD"}
VALID_TYPES = {"Employment", "Public Space"}
VALID_CATEGORIES = {
    "healthcare", "aged_care", "education", "quarantine", "construction",
    "mining", "transport", "emergency", "public_service", "public_space",
    "travel", "other"
}


def validate(db_path):
    if not os.path.exists(db_path):
        print(f"Error: Database not found: {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    passed = 0
    warnings = 0
    errors = 0

    # 1. Total record count (expected 250-320)
    total = cursor.execute("SELECT COUNT(*) FROM mandates").fetchone()[0]
    if 250 <= total <= 320:
        print(f"  PASS  Total records: {total} (expected 250-320)")
        passed += 1
    else:
        print(f"  WARN  Total records: {total} (expected 250-320)")
        warnings += 1

    # 2. Jurisdiction distribution
    rows = cursor.execute("SELECT jurisdiction, COUNT(*) as cnt FROM mandates GROUP BY jurisdiction").fetchall()
    dist = {r["jurisdiction"]: r["cnt"] for r in rows}
    invalid_j = set(dist.keys()) - VALID_JURISDICTIONS
    if not invalid_j and len(dist) == 8:
        dist_str = ", ".join(f"{k}={v}" for k, v in sorted(dist.items()))
        print(f"  PASS  Jurisdiction distribution: {dist_str}")
        passed += 1
    else:
        print(f"  FAIL  Invalid jurisdictions: {invalid_j}")
        errors += 1

    # 3. Type field values
    type_rows = cursor.execute("SELECT DISTINCT type FROM mandates WHERE type IS NOT NULL").fetchall()
    types = {r[0] for r in type_rows}
    invalid_types = types - VALID_TYPES
    if not invalid_types:
        print(f"  PASS  Type field: only {types}")
        passed += 1
    else:
        print(f"  FAIL  Invalid type values: {invalid_types}")
        errors += 1

    # 4. Date range check (effective_date between 2020-01-01 and 2023-12-31)
    out_of_range = cursor.execute("""
        SELECT id, effective_date FROM mandates
        WHERE effective_date IS NOT NULL
        AND (effective_date < '2020-01-01' OR effective_date > '2023-12-31')
    """).fetchall()
    if not out_of_range:
        print(f"  PASS  All effective_date values within 2020-01-01 to 2023-12-31")
        passed += 1
    else:
        ids = [r["id"] for r in out_of_range]
        print(f"  WARN  {len(out_of_range)} records with effective_date outside expected range: {ids[:5]}")
        warnings += 1

    # 5. Removal date >= effective date
    bad_dates = cursor.execute("""
        SELECT id, effective_date, removal_date FROM mandates
        WHERE effective_date IS NOT NULL AND removal_date IS NOT NULL
        AND removal_date < effective_date
    """).fetchall()
    if not bad_dates:
        print(f"  PASS  All removal_date >= effective_date")
        passed += 1
    else:
        ids = [r["id"] for r in bad_dates]
        print(f"  WARN  {len(bad_dates)} records with removal_date < effective_date: {ids[:5]}")
        warnings += 1

    # 6. No duplicate IDs
    dup_count = cursor.execute("""
        SELECT id, COUNT(*) as cnt FROM mandates GROUP BY id HAVING cnt > 1
    """).fetchall()
    if not dup_count:
        print(f"  PASS  No duplicate IDs")
        passed += 1
    else:
        ids = [r["id"] for r in dup_count]
        print(f"  FAIL  Duplicate IDs found: {ids}")
        errors += 1

    # 7. Category values in mandate_categories table
    cat_rows = cursor.execute("SELECT DISTINCT category FROM mandate_categories").fetchall()
    categories = {r[0] for r in cat_rows}
    invalid_cats = categories - VALID_CATEGORIES
    if not invalid_cats:
        print(f"  PASS  All categories valid: {len(categories)} unique values")
        passed += 1
    else:
        print(f"  WARN  Unexpected categories: {invalid_cats}")
        warnings += 1

    # 8. Every mandate has at least one category
    no_cat = cursor.execute("""
        SELECT m.id FROM mandates m
        LEFT JOIN mandate_categories mc ON m.id = mc.mandate_id
        WHERE mc.mandate_id IS NULL
    """).fetchall()
    if not no_cat:
        print(f"  PASS  Every mandate has at least one category")
        passed += 1
    else:
        ids = [r["id"] for r in no_cat]
        print(f"  WARN  {len(no_cat)} mandates without categories: {ids[:5]}")
        warnings += 1

    # 9. date_uncertain consistency
    uncertain_with_date = cursor.execute("""
        SELECT id FROM mandates
        WHERE date_uncertain = 1 AND effective_date IS NOT NULL
    """).fetchall()
    if not uncertain_with_date:
        print(f"  PASS  date_uncertain=1 records have NULL effective_date")
        passed += 1
    else:
        ids = [r["id"] for r in uncertain_with_date]
        print(f"  WARN  {len(uncertain_with_date)} uncertain records have effective_date set: {ids[:5]}")
        warnings += 1

    # 10. Category association count
    cat_total = cursor.execute("SELECT COUNT(*) FROM mandate_categories").fetchone()[0]
    if cat_total > 0:
        print(f"  PASS  Category associations: {cat_total}")
        passed += 1
    else:
        print(f"  FAIL  No category associations found")
        errors += 1

    conn.close()

    print(f"\nValidation complete: {passed} passed, {warnings} warnings, {errors} errors")
    return errors == 0


if __name__ == "__main__":
    db_file = sys.argv[1] if len(sys.argv) > 1 else "mandates.db"
    success = validate(db_file)
    sys.exit(0 if success else 1)
