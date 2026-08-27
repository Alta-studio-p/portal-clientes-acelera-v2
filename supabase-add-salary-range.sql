-- Guarda el rango salarial que busca el cliente, extraído por LLM de sus
-- llamadas (scripts/enrich-salary-range.mjs). Ejecutar en el SQL editor del
-- proyecto Supabase: lbxwephfuitsvlbetvlb

alter table public.clients
  add column if not exists desired_salary_range text,
  add column if not exists desired_salary_range_generated_at timestamptz;
