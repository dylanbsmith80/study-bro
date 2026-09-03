# Study Bro Platform

Authenticated customer and admin application. Deploy this folder as a separate Vercel project with `platform` configured as its Root Directory.

## Configuration

Replace the placeholders in `config.js` with the public Supabase project URL and publishable key. The publishable key is safe for browser use because access is enforced by the Row Level Security policies in `../supabase/schema.sql`. Never place the Supabase service-role key in this folder.

## Routes

- `/` — sign in and customer library
- `/deck/:id` — personal deck editor
- `/player.html?id=:id` — existing Study Bro modes with authenticated deck loading
- `/admin` — admin-only publishing and access controls
