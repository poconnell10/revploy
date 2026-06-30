-- 009_user_invitations.sql
-- Pending user invitations with scoped role assignment.

create table user_invitations (
  id uuid primary key default uuidv7(),
  email text not null,
  invited_by uuid,
  role_id uuid references roles,
  scope_type text not null check (scope_type in ('global', 'region', 'property')),
  scope_id uuid,
  token text unique not null,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

alter table user_invitations enable row level security;
