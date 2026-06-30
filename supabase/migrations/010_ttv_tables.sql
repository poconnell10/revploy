-- 010_ttv_tables.sql
-- Time-to-value (TTV) events and the scoring parameter table.

create table ttv_events (
  id uuid primary key default uuidv7(),
  property_id uuid references properties,
  category text not null check (category in (
    'kickoff_calls',
    'products_revenue',
    'front_desk_sop',
    'ingauge_config',
    'elearning',
    'administrative',
    'data',
    'infrastructure_integration'
  )),
  phase text not null check (phase in ('data', 'configuration', 'provisioning')),
  priority integer not null check (priority between 1 and 3),
  window_days integer not null check (window_days > 0),
  t_start date,
  t_due date,
  t_done date,
  t_meet date,
  no_contact boolean default false,
  escalated boolean default false,
  dependency_id uuid references ttv_events,
  d_bank numeric default 0,
  last_notice text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table ttv_parameters (
  key text primary key,
  value numeric not null,
  description text,
  updated_at timestamptz default now()
);

-- Seed the 12 v1 scoring parameters.
insert into ttv_parameters (key, value, description) values
  ('b_max', 1.20, 'Pace bonus cap'),
  ('b', 0.20, 'Early bonus rate'),
  ('k', 0.50, 'Late decay rate'),
  ('m_floor', 0.20, 'Late credit floor'),
  ('g', 0.20, 'Grace fraction before overdue'),
  ('s', 0.70, 'Overdue steepness'),
  ('e', 1.30, 'Overdue exponent convexity'),
  ('n_cap', -0.20, 'Not-started stalling cap'),
  ('a_appr', 0.30, 'Notification approach band'),
  ('a_final', 0.10, 'Notification final band'),
  ('t_blk', -0.50, 'Blocker alert threshold'),
  ('t_esc', -1.00, 'Senior escalation threshold')
on conflict (key) do nothing;

alter table ttv_events enable row level security;
