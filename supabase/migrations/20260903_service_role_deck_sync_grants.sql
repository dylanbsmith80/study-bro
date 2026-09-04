-- Let the repository sync publish master decks while keeping its database
-- privileges narrower than the authenticated admin application's privileges.

grant usage on schema public to service_role;
grant select, insert, update on public.decks, public.cards to service_role;
