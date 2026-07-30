DROP POLICY IF EXISTS "Anyone can add to an open session" ON public.individuals;
CREATE POLICY "Anyone can add to an existing session"
ON public.individuals
FOR INSERT
TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = individuals.session_id));