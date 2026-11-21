CREATE TABLE IF NOT EXISTS marketplace_listings (
 id UUID PRIMARY KEY,
 client_ref VARCHAR(100) UNIQUE,
 title VARCHAR(120) NOT NULL,
 category VARCHAR(32) NOT NULL,
 product_type VARCHAR(32) NOT NULL DEFAULT 'other',
 listing_type VARCHAR(16) NOT NULL DEFAULT 'sale',
 condition VARCHAR(16) NOT NULL DEFAULT 'unknown',
 governorate VARCHAR(80) NOT NULL DEFAULT '',
 district VARCHAR(100) NOT NULL DEFAULT '',
 area VARCHAR(120) NOT NULL DEFAULT '',
 village VARCHAR(120) NOT NULL DEFAULT '',
 country VARCHAR(80) NOT NULL DEFAULT 'اليمن',
 description VARCHAR(1800) NOT NULL DEFAULT '',
 phone VARCHAR(50) NOT NULL DEFAULT '',
 opening_hours VARCHAR(120) NOT NULL DEFAULT '',
 website VARCHAR(320) NOT NULL DEFAULT '',
 seller_name VARCHAR(100) NOT NULL DEFAULT '',
 price VARCHAR(80) NOT NULL DEFAULT '',
 currency VARCHAR(8) NOT NULL DEFAULT 'YER',
 image_data TEXT NOT NULL DEFAULT '',
 latitude DOUBLE PRECISION,
 longitude DOUBLE PRECISION,
 deadline DATE,
 status VARCHAR(16) NOT NULL DEFAULT 'pending',
 review_note VARCHAR(500) NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 approved_at TIMESTAMPTZ,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '120 days'),
 CHECK(status IN ('pending','approved','rejected','sold','archived')),
 CHECK(latitude IS NULL OR latitude BETWEEN -90 AND 90),
 CHECK(longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS opening_hours VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS website VARCHAR(320) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS marketplace_public_idx ON marketplace_listings(status,category,governorate,created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_product_idx ON marketplace_listings(product_type,created_at DESC) WHERE category='souq';
CREATE INDEX IF NOT EXISTS marketplace_jobs_deadline_idx ON marketplace_listings(deadline) WHERE category='jobs' AND status='approved';
CREATE TABLE IF NOT EXISTS marketplace_moderation_log (
 id BIGSERIAL PRIMARY KEY,
 listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
 action VARCHAR(16) NOT NULL CHECK(action IN ('approved','rejected')),
 note VARCHAR(500) NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS dalilna_schema_migrations(version INTEGER PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO dalilna_schema_migrations(version) VALUES(1),(2) ON CONFLICT(version) DO NOTHING;


-- Migration 3: opt-in public job-seeker profiles and 60-day marketplace expiry.
UPDATE marketplace_listings
SET expires_at=LEAST(expires_at,created_at+INTERVAL '60 days')
WHERE category IN ('souq','land') AND expires_at>created_at+INTERVAL '60 days';

CREATE TABLE IF NOT EXISTS job_seekers (
 id UUID PRIMARY KEY,
 full_name VARCHAR(100) NOT NULL,
 specialty VARCHAR(120) NOT NULL,
 experience_years INTEGER NOT NULL CHECK(experience_years BETWEEN 0 AND 60),
 country VARCHAR(80) NOT NULL,
 governorate VARCHAR(80) NOT NULL DEFAULT '',
 bio VARCHAR(800) NOT NULL,
 phone VARCHAR(24) NOT NULL,
 consent_public BOOLEAN NOT NULL DEFAULT FALSE,
 status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '60 days')
);
CREATE INDEX IF NOT EXISTS job_seekers_public_idx ON job_seekers(country,status,created_at DESC) WHERE consent_public=TRUE;
CREATE INDEX IF NOT EXISTS job_seekers_expiry_idx ON job_seekers(expires_at);
INSERT INTO dalilna_schema_migrations(version) VALUES(1),(2),(3) ON CONFLICT(version) DO NOTHING;
