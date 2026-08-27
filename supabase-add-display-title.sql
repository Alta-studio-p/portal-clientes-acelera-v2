-- Agrega una columna para el título limpio generado por LLM, sin tocar
-- calls.title (que sigue siendo el título crudo que viene de Fathom).
-- Ejecutar en el SQL editor del proyecto Supabase: lbxwephfuitsvlbetvlb

alter table public.calls
  add column if not exists display_title text,
  add column if not exists display_title_generated_at timestamptz;
