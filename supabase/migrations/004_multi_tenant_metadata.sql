-- 004_multi_tenant_metadata.sql
-- Multi-tenant reference data: brands, owners, regions.

create table brands (
  id uuid primary key default uuidv7(),
  code text unique,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table owners (
  id uuid primary key default uuidv7(),
  code text unique,
  name text not null,
  owner_type text check (owner_type in ('reit', 'pe_fund', 'independent', 'other')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table regions (
  id uuid primary key default uuidv7(),
  code text unique,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table brands enable row level security;
alter table owners enable row level security;
alter table regions enable row level security;
