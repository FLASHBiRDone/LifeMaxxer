-- Seed a minimal set of ingredients and recipes for local development.
-- Phase 5 will expand this to ~500 ingredients and ~100 recipes.
-- Allergens are a union of ingredient allergens, verified at insert.

insert into public.ingredients (name_en, name_nb, allergens, category) values
  ('oats', 'havre', array['gluten']::text[], 'grain'),
  ('banana', 'banan', array[]::text[], 'fruit'),
  ('milk', 'melk', array['dairy','lactose']::text[], 'dairy'),
  ('egg', 'egg', array['egg']::text[], 'protein'),
  ('rice', 'ris', array[]::text[], 'grain'),
  ('chicken breast', 'kyllingbryst', array[]::text[], 'protein'),
  ('olive oil', 'olivenolje', array[]::text[], 'fat'),
  ('salt', 'salt', array[]::text[], 'seasoning')
on conflict do nothing;
