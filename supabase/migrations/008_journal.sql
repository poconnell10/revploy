-- 008_journal.sql
-- Journal entries, with single-level reply threading, plus reactions and
-- attachments.

create table journal_entries (
  id uuid primary key default uuidv7(),
  code text unique,
  property_id uuid references properties,
  author_id uuid not null,
  parent_id uuid references journal_entries,
  entry_type text not null check (entry_type in ('user_note', 'system_event')),
  body text not null,
  customer_visible boolean default false,
  system_template text,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enforce a maximum reply depth of 1: a reply may only attach to a top-level
-- entry (one whose own parent_id is null).
create or replace function enforce_journal_reply_depth() returns trigger
language plpgsql
as $$
declare
  v_parent_parent uuid;
begin
  select parent_id into v_parent_parent
  from journal_entries
  where id = new.parent_id;

  if not found then
    raise exception 'Parent journal entry % does not exist.', new.parent_id;
  end if;

  if v_parent_parent is not null then
    raise exception 'Reply depth limited to 1.';
  end if;

  return new;
end;
$$;

create trigger trg_journal_reply_depth
  before insert or update on journal_entries
  for each row
  when (new.parent_id is not null)
  execute function enforce_journal_reply_depth();

create table journal_entry_reactions (
  id uuid primary key default uuidv7(),
  entry_id uuid references journal_entries,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique (entry_id, user_id, emoji)
);

create table journal_entry_attachments (
  id uuid primary key default uuidv7(),
  entry_id uuid references journal_entries,
  file_name text not null,
  file_url text not null,
  file_size integer,
  created_at timestamptz default now()
);

alter table journal_entries enable row level security;
alter table journal_entry_reactions enable row level security;
alter table journal_entry_attachments enable row level security;
