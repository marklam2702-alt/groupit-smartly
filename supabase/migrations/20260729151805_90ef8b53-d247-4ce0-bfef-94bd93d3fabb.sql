CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_token text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.individuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  nick_name text NOT NULL,
  industry text NOT NULL,
  industry_other text,
  expertise text NOT NULL,
  expertise_other text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX individuals_session_id_idx ON public.individuals(session_id);

-- host_token is intentionally excluded from anon/authenticated column grants
GRANT SELECT (id, code, status, result, created_at) ON public.sessions TO anon, authenticated;
GRANT ALL ON public.sessions TO service_role;

GRANT SELECT, INSERT ON public.individuals TO anon, authenticated;
GRANT ALL ON public.individuals TO service_role;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sessions" ON public.sessions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can read individuals" ON public.individuals
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can add to an open session" ON public.individuals
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.status = 'open'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.individuals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;