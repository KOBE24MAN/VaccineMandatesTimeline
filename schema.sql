-- COVID-19 Vaccine Mandates Database Schema

-- Main table: stores all mandate records
CREATE TABLE IF NOT EXISTS mandates (
    id TEXT PRIMARY KEY,                    -- Unique identifier, e.g. WA-001
    jurisdiction TEXT NOT NULL,             -- State/territory: WA, NSW, VIC, NT, SA, TAS, ACT, QLD
    name TEXT,                              -- Mandate name
    type TEXT,                              -- Type: Employment or Public Space
    target TEXT,                            -- Target population description
    target_category TEXT,                   -- Category labels, comma-separated
    effective_date TEXT,                    -- Effective date YYYY-MM-DD
    enforcement_date TEXT,                  -- Enforcement date YYYY-MM-DD
    removal_date TEXT,                      -- Removal date YYYY-MM-DD
    duration_days INTEGER,                  -- Duration in days
    date_uncertain INTEGER NOT NULL DEFAULT 0, -- Whether date is uncertain 0/1
    compliance TEXT,                        -- Compliance requirements (long text)
    exemptions TEXT,                        -- Exemption conditions (long text)
    enforcement_measures TEXT,              -- Enforcement measures (long text)
    executive_orders TEXT,                  -- Executive order names
    removal_method TEXT,                    -- How the mandate was removed
    removal_details TEXT,                   -- Removal details (long text)
    authority TEXT,                         -- Issuing authority
    mandate_communications TEXT,            -- Communication methods
    ref_code TEXT,                          -- Reference code
    ongoing INTEGER NOT NULL DEFAULT 0,     -- Whether the policy is still active 0/1
    visibility_level INTEGER                -- Frontend density level (1-6)
);

-- Category junction table for efficient category-based queries
CREATE TABLE IF NOT EXISTS mandate_categories (
    mandate_id TEXT NOT NULL,
    category TEXT NOT NULL,
    PRIMARY KEY (mandate_id, category),
    FOREIGN KEY (mandate_id) REFERENCES mandates(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mandates_jurisdiction ON mandates(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_mandates_type ON mandates(type);
CREATE INDEX IF NOT EXISTS idx_mandates_effective_date ON mandates(effective_date);
CREATE INDEX IF NOT EXISTS idx_mandates_removal_date ON mandates(removal_date);
CREATE INDEX IF NOT EXISTS idx_mandate_categories_category ON mandate_categories(category);

-- Curated contextual events displayed above the mandate timeline
CREATE TABLE IF NOT EXISTS notable_events (
    id INTEGER PRIMARY KEY,
    event_date TEXT NOT NULL,
    date_end TEXT,
    date_approximate INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    description TEXT,
    source TEXT
);
