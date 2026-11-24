-- Source of truth: Supabase migration "workspace_hub_private_cloud_settings" and
-- "workspace_hub_restrict_authenticated_privileges"; applied to MORE-SUSHI-STUDIO.
-- New table intentionally does not modify ttk_projects/ttk_documents.
CREATE TABLE IF NOT EXISTS public.workspace_hub_settings (
 owner_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 projects jsonb NOT NULL DEFAULT '[]'::jsonb,
 favorites jsonb NOT NULL DEFAULT '[]'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT workspace_hub_projects_valid CHECK (jsonb_typeof(projects)='array' AND jsonb_array_length(projects)<=80 AND octet_length(projects::text)<=180000),
 CONSTRAINT workspace_hub_favorites_valid CHECK (jsonb_typeof(favorites)='array' AND jsonb_array_length(favorites)<=150 AND octet_length(favorites::text)<=14000)
);
ALTER TABLE public.workspace_hub_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.workspace_hub_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.workspace_hub_settings TO authenticated;
CREATE POLICY workspace_hub_select_own ON public.workspace_hub_settings FOR SELECT TO authenticated USING ((SELECT auth.uid())=owner_id);
CREATE POLICY workspace_hub_insert_own ON public.workspace_hub_settings FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=owner_id);
CREATE POLICY workspace_hub_update_own ON public.workspace_hub_settings FOR UPDATE TO authenticated USING ((SELECT auth.uid())=owner_id) WITH CHECK ((SELECT auth.uid())=owner_id);
