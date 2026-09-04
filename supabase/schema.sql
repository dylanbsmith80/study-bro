-- Study Bro authenticated platform schema
-- Run once in the Supabase SQL editor for the production project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  position integer not null check (position >= 0),
  term text not null check (char_length(trim(term)) > 0),
  definition text not null check (char_length(trim(definition)) > 0),
  image_path text,
  image_alt text,
  source_key text,
  source_active boolean not null default true,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deck_id, position)
);

create table if not exists public.card_revisions (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.cards(id) on delete cascade,
  revision integer not null,
  term text not null,
  definition text not null,
  image_path text,
  image_alt text,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now(),
  unique (card_id, revision)
);

create table if not exists public.deck_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, deck_id)
);

create table if not exists public.card_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  custom_term text,
  custom_definition text,
  base_term text not null,
  base_definition text not null,
  base_revision integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id),
  check (custom_term is not null or custom_definition is not null)
);

create table if not exists public.hidden_cards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create index if not exists cards_deck_position_idx on public.cards(deck_id, position);
create unique index if not exists cards_deck_source_key_idx on public.cards(deck_id, source_key)
  where source_key is not null;
create index if not exists deck_access_user_status_idx on public.deck_access(user_id, status);
create index if not exists deck_access_deck_status_idx on public.deck_access(deck_id, status);
create index if not exists card_overrides_user_idx on public.card_overrides(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.has_deck_access(p_deck_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.deck_access
    where user_id = auth.uid()
      and deck_id = p_deck_id
      and status = 'active'
  );
$$;

create or replace function public.archive_card_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if row(old.term, old.definition, old.image_path, old.image_alt)
     is distinct from row(new.term, new.definition, new.image_path, new.image_alt) then
    insert into public.card_revisions
      (card_id, revision, term, definition, image_path, image_alt, changed_by)
    values
      (old.id, old.revision, old.term, old.definition, old.image_path, old.image_alt, auth.uid());
    new.revision = old.revision + 1;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cards_preserve_revision on public.cards;
create trigger cards_preserve_revision
  before update on public.cards
  for each row execute function public.archive_card_revision();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists decks_set_updated_at on public.decks;
create trigger decks_set_updated_at before update on public.decks
  for each row execute function public.set_updated_at();

drop trigger if exists overrides_set_updated_at on public.card_overrides;
create trigger overrides_set_updated_at before update on public.card_overrides
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.card_revisions enable row level security;
alter table public.deck_access enable row level security;
alter table public.card_overrides enable row level security;
alter table public.hidden_cards enable row level security;

revoke all on public.profiles, public.decks, public.cards, public.card_revisions,
  public.deck_access, public.card_overrides, public.hidden_cards from anon;
revoke all on public.profiles, public.decks, public.cards, public.card_revisions,
  public.deck_access, public.card_overrides, public.hidden_cards from authenticated;

grant select on public.profiles, public.decks, public.cards, public.card_revisions,
  public.deck_access, public.card_overrides, public.hidden_cards to authenticated;
grant insert, update, delete on public.decks, public.cards, public.deck_access to authenticated;
grant insert, update, delete on public.card_overrides, public.hidden_cards to authenticated;

drop policy if exists "Profiles read own or admin" on public.profiles;
create policy "Profiles read own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "Accessible decks are readable" on public.decks;
create policy "Accessible decks are readable" on public.decks for select to authenticated
  using (public.has_deck_access(id));
drop policy if exists "Admins create decks" on public.decks;
create policy "Admins create decks" on public.decks for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
drop policy if exists "Admins update decks" on public.decks;
create policy "Admins update decks" on public.decks for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete decks" on public.decks;
create policy "Admins delete decks" on public.decks for delete to authenticated
  using (public.is_admin());

drop policy if exists "Accessible cards are readable" on public.cards;
create policy "Accessible cards are readable" on public.cards for select to authenticated
  using (public.has_deck_access(deck_id));
drop policy if exists "Admins create cards" on public.cards;
create policy "Admins create cards" on public.cards for insert to authenticated
  with check (public.is_admin());
drop policy if exists "Admins update cards" on public.cards;
create policy "Admins update cards" on public.cards for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete cards" on public.cards;
create policy "Admins delete cards" on public.cards for delete to authenticated
  using (public.is_admin());

drop policy if exists "Accessible revisions are readable" on public.card_revisions;
create policy "Accessible revisions are readable" on public.card_revisions for select to authenticated
  using (exists (
    select 1 from public.cards c where c.id = card_id and public.has_deck_access(c.deck_id)
  ));

drop policy if exists "Users read own access; admins read all" on public.deck_access;
create policy "Users read own access; admins read all" on public.deck_access for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Admins grant access" on public.deck_access;
create policy "Admins grant access" on public.deck_access for insert to authenticated
  with check (public.is_admin() and granted_by = auth.uid());
drop policy if exists "Admins update access" on public.deck_access;
create policy "Admins update access" on public.deck_access for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete access" on public.deck_access;
create policy "Admins delete access" on public.deck_access for delete to authenticated
  using (public.is_admin());

drop policy if exists "Users read own overrides" on public.card_overrides;
create policy "Users read own overrides" on public.card_overrides for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Users create own overrides" on public.card_overrides;
create policy "Users create own overrides" on public.card_overrides for insert to authenticated
  with check (
    user_id = auth.uid() and exists (
      select 1 from public.cards c where c.id = card_id and public.has_deck_access(c.deck_id)
    )
  );
drop policy if exists "Users update own overrides" on public.card_overrides;
create policy "Users update own overrides" on public.card_overrides for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists "Users delete own overrides" on public.card_overrides;
create policy "Users delete own overrides" on public.card_overrides for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users read own hidden cards" on public.hidden_cards;
create policy "Users read own hidden cards" on public.hidden_cards for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Users hide accessible cards" on public.hidden_cards;
create policy "Users hide accessible cards" on public.hidden_cards for insert to authenticated
  with check (
    user_id = auth.uid() and exists (
      select 1 from public.cards c where c.id = card_id and public.has_deck_access(c.deck_id)
    )
  );
drop policy if exists "Users restore own cards" on public.hidden_cards;
create policy "Users restore own cards" on public.hidden_cards for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.get_my_library()
returns table (
  id uuid,
  slug text,
  title text,
  description text,
  card_count bigint,
  granted_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select d.id, d.slug, d.title, d.description, count(c.id), da.granted_at, d.updated_at
  from public.deck_access da
  join public.decks d on d.id = da.deck_id
  left join public.cards c on c.deck_id = d.id and c.source_active
  where da.user_id = auth.uid() and da.status = 'active' and d.status = 'published'
  group by d.id, da.granted_at
  order by da.granted_at desc;
$$;

create or replace function public.get_effective_deck(p_deck_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare result jsonb;
begin
  if not public.has_deck_access(p_deck_id) then
    raise exception 'Deck access denied';
  end if;

  select jsonb_build_object(
    'id', d.id,
    'slug', d.slug,
    'title', d.title,
    'description', d.description,
    'cards', coalesce(jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'cardId', c.id,
        'term', coalesce(o.custom_term, c.term),
        'definition', coalesce(o.custom_definition, c.definition),
        'image', c.image_path,
        'imageAlt', c.image_alt,
        'masterTerm', c.term,
        'masterDefinition', c.definition,
        'masterRevision', c.revision,
        'baseRevision', o.base_revision,
        'personalized', (o.card_id is not null),
        'masterUpdated', (o.card_id is not null and o.base_revision < c.revision)
      )) order by c.position
    ) filter (where c.id is not null and h.card_id is null), '[]'::jsonb)
  ) into result
  from public.decks d
  left join public.cards c on c.deck_id = d.id and c.source_active
  left join public.card_overrides o on o.card_id = c.id and o.user_id = auth.uid()
  left join public.hidden_cards h on h.card_id = c.id and h.user_id = auth.uid()
  where d.id = p_deck_id
  group by d.id;

  if result is null then raise exception 'Deck not found'; end if;
  return result;
end;
$$;

create or replace function public.admin_import_deck(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_deck_id uuid;
  card jsonb;
  card_number integer := 0;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if jsonb_typeof(p_payload -> 'cards') <> 'array' or jsonb_array_length(p_payload -> 'cards') = 0 then
    raise exception 'A deck needs at least one card';
  end if;

  insert into public.decks (slug, title, description, status, created_by)
  values (
    trim(p_payload ->> 'slug'),
    trim(p_payload ->> 'title'),
    coalesce(trim(p_payload ->> 'description'), ''),
    'published',
    auth.uid()
  ) returning id into new_deck_id;

  for card in select value from jsonb_array_elements(p_payload -> 'cards') loop
    if coalesce(trim(card ->> 'term'), '') = '' or coalesce(trim(card ->> 'definition'), '') = '' then
      raise exception 'Every card needs a term and definition';
    end if;
    insert into public.cards (deck_id, position, term, definition, image_path, image_alt)
    values (
      new_deck_id,
      card_number,
      trim(card ->> 'term'),
      trim(card ->> 'definition'),
      nullif(trim(card ->> 'image'), ''),
      nullif(trim(card ->> 'imageAlt'), '')
    );
    card_number := card_number + 1;
  end loop;

  return new_deck_id;
end;
$$;

create or replace function public.admin_grant_access(p_email text, p_deck_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_user uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select id into target_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if target_user is null then raise exception 'No Study Bro account exists for that email'; end if;

  insert into public.deck_access (user_id, deck_id, status, granted_by, granted_at, revoked_at)
  values (target_user, p_deck_id, 'active', auth.uid(), now(), null)
  on conflict (user_id, deck_id) do update
    set status = 'active', granted_by = auth.uid(), granted_at = now(), revoked_at = null;
end;
$$;

create or replace function public.admin_revoke_access(p_email text, p_deck_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  update public.deck_access da
  set status = 'revoked', revoked_at = now()
  from auth.users u
  where da.user_id = u.id and lower(u.email) = lower(trim(p_email)) and da.deck_id = p_deck_id;
end;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.has_deck_access(uuid) from public;
revoke all on function public.get_my_library() from public;
revoke all on function public.get_effective_deck(uuid) from public;
revoke all on function public.admin_import_deck(jsonb) from public;
revoke all on function public.admin_grant_access(text, uuid) from public;
revoke all on function public.admin_revoke_access(text, uuid) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_deck_access(uuid) to authenticated;
grant execute on function public.get_my_library() to authenticated;
grant execute on function public.get_effective_deck(uuid) to authenticated;
grant execute on function public.admin_import_deck(jsonb) to authenticated;
grant execute on function public.admin_grant_access(text, uuid) to authenticated;
grant execute on function public.admin_revoke_access(text, uuid) to authenticated;

-- Private deck images. Object paths use: <deck-uuid>/<filename>
insert into storage.buckets (id, name, public, file_size_limit)
values ('deck-assets', 'deck-assets', false, 10485760)
on conflict (id) do update set public = false;

drop policy if exists "Users read images for accessible decks" on storage.objects;
create policy "Users read images for accessible decks" on storage.objects for select to authenticated
  using (
    bucket_id = 'deck-assets'
    and public.has_deck_access(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Admins upload deck images" on storage.objects;
create policy "Admins upload deck images" on storage.objects for insert to authenticated
  with check (bucket_id = 'deck-assets' and public.is_admin());
drop policy if exists "Admins update deck images" on storage.objects;
create policy "Admins update deck images" on storage.objects for update to authenticated
  using (bucket_id = 'deck-assets' and public.is_admin())
  with check (bucket_id = 'deck-assets' and public.is_admin());
drop policy if exists "Admins delete deck images" on storage.objects;
create policy "Admins delete deck images" on storage.objects for delete to authenticated
  using (bucket_id = 'deck-assets' and public.is_admin());

-- Bootstrap the first admin only after that person has signed up through the app:
-- update public.profiles set role = 'admin' where email = 'YOUR_EMAIL@example.com';
