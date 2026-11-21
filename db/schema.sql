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
INSERT INTO dalilna_schema_migrations(version) VALUES(1) ON CONFLICT(version) DO NOTHING;
