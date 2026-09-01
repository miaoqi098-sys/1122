PRAGMA foreign_keys = ON;

-- Distinguish a real profile snapshot from a completed Sif lookup that returned no profile data.
ALTER TABLE sif_asin_profile_snapshots
ADD COLUMN data_status TEXT NOT NULL DEFAULT 'DATA';

CREATE INDEX IF NOT EXISTS idx_sif_profile_product_status_time
  ON sif_asin_profile_snapshots(product_id, data_status, observed_at);

-- Backfill completed historical profile lookups whose Sif payload explicitly contained an empty list.
INSERT OR IGNORE INTO sif_asin_profile_snapshots (
  snapshot_id,
  product_id,
  marketplace,
  asin,
  observed_at,
  source,
  parser_version,
  data_status
)
SELECT
  'nodata-' || observation_id,
  product_id,
  COALESCE(marketplace, 'US'),
  subject_key,
  observed_at,
  'sif',
  COALESCE(parser_version, 'sif-v1'),
  'NO_DATA'
FROM external_tool_observations
WHERE provider = 'sif'
  AND tool_name = 'market_get_asin_profile'
  AND subject_type = 'asin'
  AND product_id IS NOT NULL
  AND json_type(payload_json, '$.list') = 'array'
  AND json_array_length(json_extract(payload_json, '$.list')) = 0;

-- Future completed profile lookups with an explicit empty list automatically become NO_DATA snapshots.
-- This makes stale-product rotation treat "checked, no Sif coverage" as a completed observation.
CREATE TRIGGER IF NOT EXISTS trg_sif_profile_no_data_observation
AFTER INSERT ON external_tool_observations
WHEN NEW.provider = 'sif'
  AND NEW.tool_name = 'market_get_asin_profile'
  AND NEW.subject_type = 'asin'
  AND NEW.product_id IS NOT NULL
  AND json_type(NEW.payload_json, '$.list') = 'array'
  AND json_array_length(json_extract(NEW.payload_json, '$.list')) = 0
BEGIN
  INSERT OR IGNORE INTO sif_asin_profile_snapshots (
    snapshot_id,
    product_id,
    marketplace,
    asin,
    observed_at,
    source,
    parser_version,
    data_status
  ) VALUES (
    'nodata-' || NEW.observation_id,
    NEW.product_id,
    COALESCE(NEW.marketplace, 'US'),
    NEW.subject_key,
    NEW.observed_at,
    'sif',
    COALESCE(NEW.parser_version, 'sif-v1'),
    'NO_DATA'
  );
END;
