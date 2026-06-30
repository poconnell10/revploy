-- 005_properties.sql
-- Properties and their brand/owner history and contacts.

create table properties (
  id uuid primary key default uuidv7(),
  code text unique not null,
  name text not null,
  lifecycle_state text not null default 'onboarding'
    check (lifecycle_state in ('onboarding', 'activated', 'archived')),
  phase_current text default 'data'
    check (phase_current in ('data', 'configuration', 'provisioning')),
  salesforce_id text unique,
  ingauge_id text unique,
  region_id uuid references regions,
  brand_id uuid references brands,
  owner_id uuid references owners,
  billing_entity_id uuid,
  room_count integer,
  country text,
  city text,
  timezone text,
  start_date date,
  activation_date date,
  archived_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table property_brand_history (
  id uuid primary key default uuidv7(),
  property_id uuid references properties,
  brand_id uuid references brands,
  effective_from date not null,
  effective_to date,
  created_at timestamptz default now()
);

create table property_owner_history (
  id uuid primary key default uuidv7(),
  property_id uuid references properties,
  owner_id uuid references owners,
  effective_from date not null,
  effective_to date,
  created_at timestamptz default now()
);

create table property_contacts (
  id uuid primary key default uuidv7(),
  property_id uuid references properties,
  user_id uuid not null,
  role_type text not null check (role_type in ('tech_owner', 'csc', 'gm', 'other')),
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table properties enable row level security;
alter table property_brand_history enable row level security;
alter table property_owner_history enable row level security;
alter table property_contacts enable row level security;
