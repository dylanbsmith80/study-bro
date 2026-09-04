-- Safely support repository-driven deck sync without deleting customer history.

alter table public.cards
  add column if not exists source_key text;

alter table public.cards
  add column if not exists source_active boolean not null default true;

create unique index if not exists cards_deck_source_key_idx on public.cards(deck_id, source_key)
  where source_key is not null;

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

revoke all on function public.get_my_library() from public;
revoke all on function public.get_effective_deck(uuid) from public;
grant execute on function public.get_my_library() to authenticated;
grant execute on function public.get_effective_deck(uuid) to authenticated;
