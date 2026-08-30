-- Three tables. Lime owns identity; a provider is a source, not the ontology.
-- Applied at boot by a nine-line runner: a migration framework would be a
-- dependency to manage one file.

CREATE TABLE IF NOT EXISTS place (
  id                uuid PRIMARY KEY,
  canonical_name    text NOT NULL,
  short_name        text NOT NULL,
  normalized_name   text NOT NULL,
  brand_key         text,
  latitude          double precision NOT NULL,
  longitude         double precision NOT NULL,
  entity_type       text NOT NULL,
  entity_subtype    text,
  provider_types    jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags              jsonb NOT NULL DEFAULT '{}'::jsonb,
  h3_r5             text NOT NULL,
  h3_r7             text NOT NULL,
  h3_r8             text NOT NULL,
  h3_r9             text NOT NULL,
  h3_r10            text NOT NULL,
  h3_r11            text NOT NULL,
  indexed_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  source_updated_at timestamptz,
  fields_expire_at  timestamptz,
  status            text NOT NULL DEFAULT 'active'
);

-- The identity join. One Lime place may carry a Google id and a Mapbox id and
-- later an OSM or operator id.
CREATE TABLE IF NOT EXISTS place_source (
  place_id          uuid NOT NULL REFERENCES place(id) ON DELETE CASCADE,
  provider          text NOT NULL,
  provider_place_id text NOT NULL,
  source_updated_at timestamptz,
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, provider, provider_place_id)
);

-- What we actually asked, not what we hope we know.
CREATE TABLE IF NOT EXISTS cell_coverage (
  provider            text NOT NULL,
  query_family        text NOT NULL,
  h3_index            text NOT NULL,
  resolution          integer NOT NULL,
  coverage_status     text NOT NULL DEFAULT 'unknown',
  last_hydrated_at    timestamptz,
  expires_at          timestamptz,
  result_count        integer NOT NULL DEFAULT 0,
  query_radius_meters integer,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (provider, query_family, h3_index, resolution)
);

CREATE UNIQUE INDEX IF NOT EXISTS place_source_provider_id_uniq
  ON place_source (provider, provider_place_id);
CREATE INDEX IF NOT EXISTS place_r9_entity_idx  ON place (h3_r9, entity_type);
CREATE INDEX IF NOT EXISTS place_r10_entity_idx ON place (h3_r10, entity_type);
CREATE INDEX IF NOT EXISTS place_r9_name_idx    ON place (h3_r9, normalized_name);
CREATE INDEX IF NOT EXISTS place_r9_brand_idx   ON place (h3_r9, brand_key);
CREATE INDEX IF NOT EXISTS place_r10_brand_idx  ON place (h3_r10, brand_key);
