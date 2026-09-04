# Study Bro Supabase

`schema.sql` creates the production data model, revision history, customer access controls, admin-only publishing functions, private user overrides, and private image-storage policies.

## Security model

- Customers can read only decks actively assigned to their account.
- Customers can read and change only their own card overrides and hidden-card choices.
- Administrators alone can create or update master decks and manage access.
- Admin status is never self-selectable and must be assigned by a database owner.
- The browser receives only the public Supabase publishable key. Never expose the service-role key.

## Automatic deck publishing

GitHub Actions runs `.github/workflows/sync-study-bro-decks.yml` whenever a JSON file under `decks/` or an image under `deck-assets/` changes on `main`. The workflow:

- validates every repository deck and referenced image;
- creates or updates the matching Supabase deck by slug;
- keeps card IDs stable across ordinary edits, insertions, and reordering so customer overrides remain attached;
- archives cards removed from a source deck instead of deleting customer history;
- uploads local card images into the private `deck-assets` bucket; and
- makes every published deck visible to administrators and ready to grant to customers.

The repository must contain a GitHub Actions secret named `SUPABASE_SERVICE_ROLE_KEY`. This key is used only by GitHub Actions and must never be committed or exposed to the browser.

## First admin

After the owner creates an account through the deployed Study Bro platform, run the final commented `update` statement in `schema.sql` with the owner email.
