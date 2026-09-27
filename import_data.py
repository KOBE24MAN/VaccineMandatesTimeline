"""
CSV to SQLite import script.
Imports cleaned mandate data from All_Mandates.csv into mandates.db
"""

import csv
import sqlite3
import os
import sys


def create_tables(conn):
    """Create database tables and indexes."""
    cursor = conn.cursor()
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS mandates (
            id TEXT PRIMARY KEY,
            jurisdiction TEXT NOT NULL,
            name TEXT,
            type TEXT,
            target TEXT,
            target_category TEXT,
            effective_date TEXT,
            enforcement_date TEXT,
            removal_date TEXT,
            duration_days INTEGER,
            date_uncertain INTEGER NOT NULL DEFAULT 0,
            compliance TEXT,
            exemptions TEXT,
            enforcement_measures TEXT,
            executive_orders TEXT,
            removal_method TEXT,
            removal_details TEXT,
            authority TEXT,
            mandate_communications TEXT,
            ref_code TEXT
        );

        CREATE TABLE IF NOT EXISTS mandate_categories (
            mandate_id TEXT NOT NULL,
            category TEXT NOT NULL,
            PRIMARY KEY (mandate_id, category),
            FOREIGN KEY (mandate_id) REFERENCES mandates(id)
        );

        CREATE INDEX IF NOT EXISTS idx_mandates_jurisdiction ON mandates(jurisdiction);
        CREATE INDEX IF NOT EXISTS idx_mandates_type ON mandates(type);
        CREATE INDEX IF NOT EXISTS idx_mandates_effective_date ON mandates(effective_date);
        CREATE INDEX IF NOT EXISTS idx_mandates_removal_date ON mandates(removal_date);
        CREATE INDEX IF NOT EXISTS idx_mandate_categories_category ON mandate_categories(category);
    """)
    conn.commit()


def clean_value(value):
    """Convert empty strings to None."""
    if value is None or value.strip() == "":
        return None
    return value.strip()


def parse_boolean(value):
    """Convert TRUE/FALSE string to 1/0."""
    if value is None:
        return 0
    v = value.strip().upper()
    return 1 if v in ("TRUE", "1") else 0


def parse_int(value):
    """Parse integer, return None for empty values."""
    cleaned = clean_value(value)
    if cleaned is None:
        return None
    try:
        return int(float(cleaned))
    except (ValueError, TypeError):
        return None


def import_csv(csv_path, db_path):
    """Main import function."""
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"Removed existing database: {db_path}")

    conn = sqlite3.connect(db_path)
    create_tables(conn)
    cursor = conn.cursor()

    # Counters
    total = 0
    jurisdiction_counts = {}
    type_counts = {}
    uncertain_count = 0
    no_removal_count = 0
    category_count = 0

    # Read CSV (handle UTF-8 BOM)
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        for row in reader:
            mandate_id = clean_value(row.get("id"))
            if not mandate_id:
                continue

            jurisdiction = clean_value(row.get("jurisdiction"))
            name = clean_value(row.get("name"))
            mandate_type = clean_value(row.get("type"))
            target = clean_value(row.get("target"))
            target_category = clean_value(row.get("target_category"))
            effective_date = clean_value(row.get("effective_date"))
            enforcement_date = clean_value(row.get("enforcement_date"))
            removal_date = clean_value(row.get("removal_date"))
            duration_days = parse_int(row.get("duration_days"))
            date_uncertain = parse_boolean(row.get("date_uncertain"))
            compliance = clean_value(row.get("compliance"))
            exemptions = clean_value(row.get("exemptions"))
            enforcement_measures = clean_value(row.get("enforcement_measures"))
            executive_orders = clean_value(row.get("executive_orders"))
            removal_method = clean_value(row.get("removal_method"))
            removal_details = clean_value(row.get("removal_details"))
            authority = clean_value(row.get("authority"))
            mandate_communications = clean_value(row.get("mandate_communications"))
            ref_code = clean_value(row.get("ref_code"))

            cursor.execute("""
                INSERT OR REPLACE INTO mandates
                (id, jurisdiction, name, type, target, target_category,
                 effective_date, enforcement_date, removal_date, duration_days,
                 date_uncertain, compliance, exemptions, enforcement_measures,
                 executive_orders, removal_method, removal_details, authority,
                 mandate_communications, ref_code)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (mandate_id, jurisdiction, name, mandate_type, target, target_category,
                  effective_date, enforcement_date, removal_date, duration_days,
                  date_uncertain, compliance, exemptions, enforcement_measures,
                  executive_orders, removal_method, removal_details, authority,
                  mandate_communications, ref_code))

            # Parse target_category into junction table
            if target_category:
                categories = [c.strip() for c in target_category.split(",") if c.strip()]
                for cat in categories:
                    cursor.execute("""
                        INSERT OR REPLACE INTO mandate_categories (mandate_id, category)
                        VALUES (?, ?)
                    """, (mandate_id, cat))
                    category_count += 1

            total += 1
            jurisdiction_counts[jurisdiction] = jurisdiction_counts.get(jurisdiction, 0) + 1
            if mandate_type:
                type_counts[mandate_type] = type_counts.get(mandate_type, 0) + 1
            if date_uncertain:
                uncertain_count += 1
            if removal_date is None:
                no_removal_count += 1

    conn.commit()
    conn.close()

    # Print summary
    print(f"\nImport complete!")
    print(f"Total records: {total}")

    jurisdictions_str = ", ".join(
        f"{k}={v}" for k, v in sorted(jurisdiction_counts.items(), key=lambda x: -x[1])
    )
    print(f"By jurisdiction: {jurisdictions_str}")

    types_str = ", ".join(
        f"{k}={v}" for k, v in sorted(type_counts.items(), key=lambda x: -x[1])
    )
    print(f"By type: {types_str}")
    print(f"Uncertain dates: {uncertain_count}")
    print(f"No removal date: {no_removal_count}")
    print(f"Category associations: {category_count}")


if __name__ == "__main__":
    csv_file = sys.argv[1] if len(sys.argv) > 1 else "All_Mandates.csv"
    db_file = sys.argv[2] if len(sys.argv) > 2 else "mandates.db"

    if not os.path.exists(csv_file):
        print(f"Error: CSV file not found: {csv_file}")
        sys.exit(1)

    print(f"Importing: {csv_file} -> {db_file}")
    import_csv(csv_file, db_file)
