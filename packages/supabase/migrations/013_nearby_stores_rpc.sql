-- =============================================================================
-- MIGRATION 013: NEARBY STORES RPC
--
-- Creates the public.get_nearby_stores() PL/pgSQL function used by the
-- customer app to discover stores that service a given delivery location.
--
-- SECURITY MODEL:
--   SECURITY DEFINER — the function runs with the privileges of its owner
--   (typically the postgres super-user role used by Supabase migrations).
--   A fixed SET search_path prevents search-path injection.  All table and
--   function references are fully qualified (public.<name>, extensions.<name>).
--
--   Execution is revoked from PUBLIC and granted only to the two roles that
--   the customer app uses: anon (unauthenticated) and authenticated.
--   Stores are publicly browsable, so anon access is intentional.
--
-- BUSINESS RULES ENFORCED HERE (not in the app):
--   1. Only active AND verified AND open stores are returned.
--   2. Only stores with a non-null, positive service radius are returned.
--      A NULL service_radius_meters means the store has not yet configured
--      delivery — it is NEVER treated as unlimited reach.
--   3. Only stores whose location column is populated are considered.
--   4. A store is included only when the customer point lies within that
--      store's own service_radius_meters (geography, metres).
--   5. Results are ordered nearest-first and capped by limit_count.
--
-- SPATIAL INDEX:
--   The existing idx_stores_location index is a GIST index on the geometry
--   column (GEOMETRY(Point,4326)).  The query in this function casts that
--   column to geography for metre-based distance calculations.  PostgreSQL
--   cannot use a geometry GIST index for an expression cast to geography, so
--   a dedicated functional GIST index on (location::geography) is added below.
--   The existing geometry index is preserved; it may be used by other queries.
-- =============================================================================

-- ─── 1. Geography expression index ──────────────────────────────────────────
-- Allows ST_DWithin(location::geography, ...) to use an index scan instead of
-- a full sequential scan of public.stores.

CREATE INDEX IF NOT EXISTS idx_stores_location_geography
  ON public.stores
  USING GIST ((location::geography));

-- ─── 2. RPC function ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_nearby_stores(
  customer_lat   DOUBLE PRECISION,
  customer_lng   DOUBLE PRECISION,
  limit_count    INTEGER DEFAULT 50
)
RETURNS TABLE (
  id                          UUID,
  name                        TEXT,
  description                 TEXT,
  logo_url                    TEXT,
  banner_url                  TEXT,
  category                    public.store_category,
  is_open                     BOOLEAN,
  average_rating              NUMERIC,
  total_ratings               INTEGER,
  estimated_delivery_minutes  INTEGER,
  minimum_order_amount        INTEGER,
  address_text                TEXT,
  distance_meters             DOUBLE PRECISION,
  service_radius_meters       INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
BEGIN
  -- ── Input validation ──────────────────────────────────────────────────────
  -- Reject coordinates outside WGS84 range and degenerate limit values.
  -- Errors surface to the caller as Postgres error code 'invalid_parameter_value'.

  IF customer_lat < -90.0 OR customer_lat > 90.0 THEN
    RAISE EXCEPTION 'customer_lat must be between -90 and 90, got %', customer_lat
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF customer_lng < -180.0 OR customer_lng > 180.0 THEN
    RAISE EXCEPTION 'customer_lng must be between -180 and 180, got %', customer_lng
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF limit_count < 1 OR limit_count > 200 THEN
    RAISE EXCEPTION 'limit_count must be between 1 and 200, got %', limit_count
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── Query ─────────────────────────────────────────────────────────────────
  -- ST_MakePoint(longitude, latitude) — PostGIS axis order: lng first, lat second.
  -- ::geography cast makes ST_DWithin and ST_Distance operate in metres.

  RETURN QUERY
    SELECT
      s.id,
      s.name,
      s.description,
      s.logo_url,
      s.banner_url,
      s.category,
      s.is_open,
      s.average_rating,
      s.total_ratings,
      s.estimated_delivery_minutes,
      s.minimum_order_amount,
      s.address_text,
      ST_Distance(
        s.location::geography,
        ST_SetSRID(ST_MakePoint(customer_lng, customer_lat), 4326)::geography
      )                           AS distance_meters,
      s.service_radius_meters
    FROM public.stores s
    WHERE
      s.is_active               = TRUE
      AND s.is_verified         = TRUE
      AND s.is_open             = TRUE
      AND s.location            IS NOT NULL
      -- NULL radius = delivery not configured: always exclude
      AND s.service_radius_meters IS NOT NULL
      -- Defensive; guaranteed by CHECK constraint but explicit here
      AND s.service_radius_meters > 0
      -- Spatial filter: customer point must be within the store's own radius
      AND ST_DWithin(
            s.location::geography,
            ST_SetSRID(ST_MakePoint(customer_lng, customer_lat), 4326)::geography,
            s.service_radius_meters
          )
    ORDER BY distance_meters ASC
    LIMIT limit_count;
END;
$$;

-- ─── 3. Grants ───────────────────────────────────────────────────────────────
-- PostgreSQL grants EXECUTE to PUBLIC by default on function creation.
-- Revoke that, then grant only to the roles the customer app uses.

REVOKE EXECUTE
  ON FUNCTION public.get_nearby_stores(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER)
  FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION public.get_nearby_stores(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER)
  TO anon, authenticated;
