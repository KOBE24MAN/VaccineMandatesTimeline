"""
COVID-19 Vaccine Mandates Data Cleaning Script
Reads Policy_Repository_Design_project.xlsx, cleans 8 Australian state sheets,
and outputs a standardized All_Mandates.csv for React frontend.
"""

import pandas as pd
import numpy as np
import re
from datetime import datetime

EXCEL_PATH = "/Users/qinding/Downloads/Policy Repository_Design project.xlsx"
OUTPUT_CSV = "/Users/qinding/capstone/All_Mandates.csv"

# ============================================================
# Standard field names
# ============================================================
STANDARD_COLS = [
    "announcement_date", "effective_date", "enforcement_date", "name", "type",
    "target", "compliance", "exemptions", "enforcement_measures",
    "mandate_communications", "removal_communications", "removal_date",
    "removal_method", "removal_details", "executive_orders", "authority", "ref_code"
]

# ============================================================
# Column rename mappings per state (original header -> standard field)
# ============================================================

# WA has unique column order: I=Executive Orders, J=Enforcement, K=Removal Date, ...
WA_RENAME = {
    "Annoucement Date": "announcement_date",
    "Policy Published/Effective Date": "effective_date",
    "Enforcement Date": "enforcement_date",
    "Name/Version": "name",
    "Type of Mandate": "type",
    "Policy Target of Mandate": "target",
    "Mandate Compliance Requirements": "compliance",
    "Exemptions and Conditions": "exemptions",
    "Executive Orders": "executive_orders",          # Col I (WA-specific position)
    "Enforcement/Noncompliance Measures": "enforcement_measures",  # Col J
    "Mandate Removal Date": "removal_date",          # Col K
    "Removal Method": "removal_method",              # Col L
    "Directions Removal Details": "removal_details", # Col M
    "Authority Issuing the Mandate": "authority",    # Col N
    "Mandate communications": "mandate_communications",  # Col O
    "Ref. Code": "ref_code",
}

# NSW/VIC/SA/ACT/QLD standard column order
NSW_GROUP_RENAME = {
    "Announcement Date": "announcement_date",
    "Policy Published/Effective Date": "effective_date",
    "Enforcement Date": "enforcement_date",
    "Name/Version": "name",
    "Type": "type",
    "Policy Target": "target",
    "Mandate Compliance Requirements": "compliance",
    "Exemptions and Conditions": "exemptions",
    "Enforcement/Noncompliance Measures": "enforcement_measures",
    "Mandate communications": "mandate_communications",
    "Removal Communications": "removal_communications",
    "Mandate Removal Date": "removal_date",
    "Mandate Removal Method": "removal_method",
    "Executive Order Removal Details": "removal_details",
    "Executive Orders": "executive_orders",
    "Authority Issuing the Mandate": "authority",
    "Ref. Code": "ref_code",
}

# NT: WA-style column names but NSW-group column order
NT_RENAME = {
    "Annoucement Date": "announcement_date",
    "Policy Published/Effective Date": "effective_date",
    "Enforcement Date": "enforcement_date",
    "Name/Version": "name",
    "Type of Mandate": "type",
    "Policy Target of Mandate": "target",
    "Mandate Compliance Requirements": "compliance",
    "Exemptions and Conditions": "exemptions",
    "Enforcement/Noncompliance Measures": "enforcement_measures",
    "Mandate communications": "mandate_communications",
    "Removal Communications": "removal_communications",
    "Mandate Removal Date": "removal_date",
    "Mandate Removal Method": "removal_method",
    "Executive Order Removal Details": "removal_details",
    "Executive Orders": "executive_orders",
    "Authority Issuing the Mandate": "authority",
    "Ref. Code": "ref_code",
}

# TAS: WA-style names, NSW-group order, slight col N name difference, Ref Code in col Y
TAS_RENAME = {
    "Annoucement Date": "announcement_date",
    "Policy Published/Effective Date": "effective_date",
    "Enforcement Date": "enforcement_date",
    "Name/Version": "name",
    "Type of Mandate": "type",
    "Policy Target of Mandate": "target",
    "Mandate Compliance Requirements": "compliance",
    "Exemptions and Conditions": "exemptions",
    "Enforcement/Noncompliance Measures": "enforcement_measures",
    "Mandate communications": "mandate_communications",
    "Removal Communications": "removal_communications",
    "Mandate Removal Date": "removal_date",
    "Mandate Removal Method": "removal_method",
    "Direction Removal Details": "removal_details",  # Slight naming difference
    "Executive Orders": "executive_orders",
    "Authority Issuing the Mandate": "authority",
    "Ref. Code": "ref_code",
}

# Columns to drop during cleaning
DROP_KEYWORDS = [
    "Removal Communications", "Type of Source", "Vaccine Elegibility",
    "Vaccine Availability", "ATAGI Reccommendations", "ATAGI",
    "Vaccine Uptake", "Population Affected", "COVID Severity",
    "COVID severity", "COVID case rates", "COVID Case Rates",
    "Additional Notes", "Ref No.", "Ref No"
]

# ============================================================
# target_category classification keywords
# ============================================================
CATEGORY_KEYWORDS = {
    "healthcare": ["health care", "healthcare", "hospital", "medical", "clinical",
                    "nurse", "doctor", "pharmacy", "paramedic", "ambulance"],
    "aged_care": ["aged care", "residential aged", "disability"],
    "education": ["education", "school", "teacher", "early childhood", "childcare"],
    "quarantine": ["quarantine"],
    "construction": ["construction"],
    "mining": ["mining"],
    "transport": ["transport", "freight", "logistics", "port", "air service",
                  "airport", "border worker"],
    "emergency": ["police", "emergency", "fire", "correction", "law enforcement"],
    "public_service": ["government", "parliamentary", "ministerial", "court",
                       "public servant"],
    "public_space": ["venue", "restaurant", "visitor", "patron", "premises",
                     "event", "gathering"],
    "travel": ["travel", "interstate", "international", "border restriction",
               "entry", "arrivals"],
}


def classify_target(target_text, type_val):
    """Classify target text into predefined categories using keyword matching."""
    if pd.isna(target_text) or str(target_text).strip() == "":
        if type_val == "Public Space":
            return "public_space"
        return "other"

    text_lower = str(target_text).lower()
    categories = []
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            categories.append(cat)

    if not categories:
        if type_val == "Public Space":
            return "public_space"
        return "other"

    return ", ".join(categories)


def parse_au_date(val):
    """Parse Australian-format dates (DD/MM/YYYY), handling various text values."""
    if pd.isna(val):
        return pd.NaT
    if isinstance(val, datetime):
        return val
    if isinstance(val, pd.Timestamp):
        return val.to_pydatetime()

    s = str(val).strip()
    if s.upper() in ("N/A", "NA", "", "CANNOT FIND"):
        return pd.NaT
    if "various removal" in s.lower():
        return pd.NaT

    # "Earlier than 23/10/2021" -> extract date portion
    earlier_match = re.search(r"Earlier than\s+(\d{1,2}/\d{1,2}/\d{4})", s, re.IGNORECASE)
    if earlier_match:
        s = earlier_match.group(1)

    # Multiple dates: take the first one ("4/11/2022 repealed\n5/4/23 rescinded" -> "4/11/2022")
    s = s.split("\n")[0].strip()
    # Strip trailing non-date text
    s = re.sub(r"\s*(repealed|rescinded|nationwide).*$", "", s, flags=re.IGNORECASE).strip()

    # Try DD/MM/YYYY and DD/MM/YY formats
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue

    return pd.NaT


def unify_type(val):
    """Normalize Type field values to Employment, Public Space, or Both."""
    if pd.isna(val):
        return val
    s = str(val).strip()

    # Replace newlines with spaces before checking
    s_flat = s.replace("\n", " ").replace("\r", " ").strip()

    # Both types combined
    if "Employment" in s_flat and "Public Space" in s_flat:
        return "Both"

    if s_flat.startswith("Employment"):
        return "Employment"
    if s_flat.startswith("Public Space"):
        return "Public Space"

    return s


def clean_text(val):
    """Clean special characters in text fields."""
    if pd.isna(val):
        return val
    s = str(val)
    # Replace non-breaking space with regular space
    s = s.replace("\xa0", " ")
    # Collapse 3+ consecutive newlines to 2
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def load_and_clean_sheet(xls, sheet_name, rename_map, jurisdiction):
    """Load and clean a single state worksheet."""
    print(f"  Processing {jurisdiction}...")

    df = pd.read_excel(xls, sheet_name, header=0)
    print(f"    Raw rows: {len(df)}, columns: {len(df.columns)}")

    # Drop unnecessary columns
    cols_to_drop = []
    for col in df.columns:
        col_str = str(col).strip()
        should_drop = False
        for kw in DROP_KEYWORDS:
            if kw.lower() in col_str.lower():
                should_drop = True
                break
        if col_str.startswith("Unnamed"):
            should_drop = True
        if should_drop:
            cols_to_drop.append(col)
    df = df.drop(columns=cols_to_drop, errors="ignore")

    # Rename columns
    actual_rename = {}
    for old_name, new_name in rename_map.items():
        if old_name in df.columns:
            actual_rename[old_name] = new_name
    df = df.rename(columns=actual_rename)

    # Ensure all standard columns exist
    for col in STANDARD_COLS:
        if col not in df.columns:
            df[col] = np.nan

    # Keep only standard columns
    df = df[[c for c in STANDARD_COLS if c in df.columns]]

    # Filter empty rows: all-null OR (effective_date null AND name null AND target null) -> drop
    # But keep rows with null effective_date if name or target has value
    def is_valid_row(row):
        if row.isna().all():
            return False
        eff_null = pd.isna(row.get("effective_date")) or str(row.get("effective_date")).strip().upper() in ("N/A", "NA", "")
        name_null = pd.isna(row.get("name")) or str(row.get("name")).strip() == ""
        target_null = pd.isna(row.get("target")) or str(row.get("target")).strip() == ""
        if eff_null and name_null and target_null:
            return False
        return True

    df = df[df.apply(is_valid_row, axis=1)].reset_index(drop=True)
    print(f"    Filtered rows: {len(df)}")

    # Add jurisdiction column
    df["jurisdiction"] = jurisdiction

    # Unify type values
    df["type"] = df["type"].apply(unify_type)

    # Parse dates
    for date_col in ["effective_date", "enforcement_date", "removal_date", "announcement_date"]:
        if date_col in df.columns:
            df[date_col] = df[date_col].apply(parse_au_date)

    # Clean text fields
    text_cols = ["name", "target", "compliance", "exemptions", "enforcement_measures",
                 "mandate_communications", "removal_communications", "removal_method",
                 "removal_details", "executive_orders", "authority", "ref_code"]
    for col in text_cols:
        if col in df.columns:
            df[col] = df[col].apply(clean_text)

    # Compute target_category
    df["target_category"] = df.apply(
        lambda row: classify_target(row.get("target"), row.get("type")), axis=1
    )

    # Compute duration_days
    def calc_duration(row):
        eff = row.get("effective_date")
        rem = row.get("removal_date")
        if pd.notna(eff) and pd.notna(rem):
            try:
                delta = pd.Timestamp(rem) - pd.Timestamp(eff)
                return delta.days
            except Exception:
                return np.nan
        return np.nan
    df["duration_days"] = df.apply(calc_duration, axis=1)

    # Mark date_uncertain
    df["date_uncertain"] = df.apply(
        lambda row: pd.isna(row["effective_date"]) and pd.notna(row.get("name")) and str(row.get("name", "")).strip() != "",
        axis=1
    )

    # Generate id
    df["id"] = [f"{jurisdiction}-{str(i+1).zfill(3)}" for i in range(len(df))]

    return df


def split_both_type(df):
    """Split rows with type='Both' into two rows: Employment and Public Space."""
    both_rows = df[df["type"] == "Both"]
    non_both = df[df["type"] != "Both"].copy()

    new_rows = []
    for _, row in both_rows.iterrows():
        for t in ["Employment", "Public Space"]:
            new_row = row.copy()
            new_row["type"] = t
            new_rows.append(new_row)

    if new_rows:
        both_expanded = pd.DataFrame(new_rows)
        result = pd.concat([non_both, both_expanded], ignore_index=True)
    else:
        result = non_both

    return result


def main():
    print("=" * 60)
    print("COVID-19 Vaccine Mandates Data Cleaning")
    print("=" * 60)

    xls = pd.ExcelFile(EXCEL_PATH)

    # Define state configurations
    state_configs = [
        ("WA", WA_RENAME, "WA"),
        ("NSW", NSW_GROUP_RENAME, "NSW"),
        ("VIC", NSW_GROUP_RENAME, "VIC"),
        ("NT", NT_RENAME, "NT"),
        ("SA", NSW_GROUP_RENAME, "SA"),
        ("TAS", TAS_RENAME, "TAS"),
        ("ACT", NSW_GROUP_RENAME, "ACT"),
        ("QLD", NSW_GROUP_RENAME, "QLD"),
    ]

    all_dfs = []
    for sheet, rename_map, jurisdiction in state_configs:
        df = load_and_clean_sheet(xls, sheet, rename_map, jurisdiction)
        all_dfs.append(df)

    # Merge all states
    print("\nMerging 8 states...")
    combined = pd.concat(all_dfs, ignore_index=True)
    print(f"  Merged rows: {len(combined)}")

    # Split Both type
    both_count = (combined["type"] == "Both").sum()
    print(f"\nSplitting 'Both' type ({both_count} records)...")
    combined = split_both_type(combined)
    print(f"  Rows after split: {len(combined)}")

    # Regenerate IDs (row numbers may have changed after split)
    combined = combined.sort_values(["jurisdiction", "effective_date"], na_position="last").reset_index(drop=True)
    combined["id"] = combined.apply(
        lambda row: f"{row['jurisdiction']}-{str(combined[combined['jurisdiction']==row['jurisdiction']].index.get_loc(row.name)+1).zfill(3)}",
        axis=1
    )

    # Final column order
    FINAL_COLS = [
        "id", "jurisdiction", "name", "type", "target", "target_category",
        "effective_date", "enforcement_date", "removal_date", "duration_days",
        "date_uncertain", "compliance", "exemptions", "enforcement_measures",
        "executive_orders", "removal_method", "removal_details", "authority",
        "mandate_communications", "ref_code"
    ]
    for col in FINAL_COLS:
        if col not in combined.columns:
            combined[col] = np.nan
    combined = combined[FINAL_COLS]

    # Format date columns as YYYY-MM-DD
    for dc in ["effective_date", "enforcement_date", "removal_date"]:
        combined[dc] = pd.to_datetime(combined[dc], errors="coerce")

    # Validation summary
    print("\n" + "=" * 60)
    print("Validation Summary")
    print("=" * 60)
    print(f"Total rows: {len(combined)}")
    print(f"Type distribution:\n{combined['type'].value_counts()}")
    print(f"\nJurisdiction distribution:\n{combined['jurisdiction'].value_counts()}")
    print(f"\nDate field types:")
    for dc in ["effective_date", "enforcement_date", "removal_date"]:
        print(f"  {dc}: {combined[dc].dtype}, non-null: {combined[dc].notna().sum()}")
    print(f"\ndate_uncertain=True rows: {combined['date_uncertain'].sum()}")
    print(f"duration_days non-null rows: {combined['duration_days'].notna().sum()}")

    both_remaining = (combined["type"] == "Both").sum()
    print(f"type='Both' remaining: {both_remaining} (should be 0)")

    # Save CSV
    combined.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"\nSaved to: {OUTPUT_CSV}")
    print(f"File exists: {pd.io.common.file_exists(OUTPUT_CSV)}")

    # Also output JSON for frontend use
    json_path = OUTPUT_CSV.replace(".csv", ".json")
    combined.to_json(json_path, orient="records", date_format="iso", force_ascii=False, indent=2)
    print(f"JSON saved to: {json_path}")


if __name__ == "__main__":
    main()
