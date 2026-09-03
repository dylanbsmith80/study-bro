# Study Bro Supabase

`schema.sql` creates the production data model, revision history, customer access controls, admin-only publishing functions, private user overrides, and private image-storage policies.

## Security model

- Customers can read only decks actively assigned to their account.
- Customers can read and change only their own card overrides and hidden-card choices.
- Administrators alone can create or update master decks and manage access.
- Admin status is never self-selectable and must be assigned by a database owner.
- The browser receives only the public Supabase publishable key. Never expose the service-role key.

## First admin

After the owner creates an account through the deployed Study Bro platform, run the final commented `update` statement in `schema.sql` with the owner email.
