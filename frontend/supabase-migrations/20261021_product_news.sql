-- Daily source snapshots; on a failed refresh the application preserves the last successful items.
CREATE TABLE IF NOT EXISTS public.product_news_sources (
  source TEXT PRIMARY KEY CHECK (source IN ('x', 'producthunt', 'github')),
  edition JSONB NOT NULL CHECK (edition->>'source' = source),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.product_news_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_news_sources FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.product_news_sources TO service_role;

CREATE OR REPLACE FUNCTION public.touch_product_news_source()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_product_news_source ON public.product_news_sources;
CREATE TRIGGER touch_product_news_source BEFORE UPDATE ON public.product_news_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_product_news_source();
