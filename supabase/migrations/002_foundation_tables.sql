-- 002_foundation_tables.sql
-- RBAC, ID-sequence, event-outbox and data-classification tables.

create table roles (
  id uuid primary key default uuidv7(),
  name text unique not null,
  description text,
  created_at timestamptz default now()
);

create table permissions (
  id uuid primary key default uuidv7(),
  key text unique not null,
  description text,
  created_at timestamptz default now()
);

create table role_permissions (
  role_id uuid references roles,
  permission_id uuid references permissions,
  primary key (role_id, permission_id)
);

create table user_role_assignments (
  id uuid primary key default uuidv7(),
  user_id uuid not null,
  role_id uuid references roles,
  scope_type text not null check (scope_type in ('global', 'region', 'property')),
  scope_id uuid null,
  created_at timestamptz default now()
);

-- Postgres does not allow expressions inside an inline UNIQUE constraint, so the
-- requested COALESCE-based uniqueness is implemented as a unique index. A null
-- scope_id (global scope) collapses to the zero UUID so it participates in the
-- uniqueness check.
create unique index user_role_assignments_unique_idx
  on user_role_assignments (
    user_id,
    role_id,
    scope_type,
    coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table id_sequences (
  prefix text primary key,
  next_val bigint default 1
);

create table event_outbox (
  id uuid primary key default uuidv7(),
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz null,
  created_at timestamptz default now()
);

create table column_classifications (
  table_name text,
  column_name text,
  sensitivity text check (sensitivity in ('public', 'internal', 'confidential', 'restricted')),
  primary key (table_name, column_name)
);

-- Enable RLS on all tables. No policies are defined yet, so only the table
-- owner and SECURITY DEFINER functions can access these tables until policies
-- are added.
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table user_role_assignments enable row level security;
alter table id_sequences enable row level security;
alter table event_outbox enable row level security;
alter table column_classifications enable row level security;
