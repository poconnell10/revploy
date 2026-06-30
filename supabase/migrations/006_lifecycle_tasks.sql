-- 006_lifecycle_tasks.sql
-- Lifecycle task definitions, per-property task instances, and the phase-gate
-- triggers that enforce the onboarding workflow.

create table lifecycle_task_definitions (
  id uuid primary key default uuidv7(),
  task_key text unique not null,
  phase text not null check (phase in ('data', 'configuration', 'provisioning')),
  display_name text not null,
  description text,
  required_role text not null,
  is_phase_gate boolean default false,
  completion_mode text not null
    check (completion_mode in ('manual_signoff', 'auto', 'auto_with_override')),
  order_index integer not null,
  timeframe_days integer,
  created_at timestamptz default now()
);

create table property_lifecycle_tasks (
  id uuid primary key default uuidv7(),
  property_id uuid references properties,
  task_definition_id uuid references lifecycle_task_definitions,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'complete', 'blocked')),
  assigned_to uuid,
  completed_by uuid,
  completed_at timestamptz,
  due_date date,
  blocked_reason text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (property_id, task_definition_id)
);

-- ---------------------------------------------------------------------------
-- Gate 1: a configuration-phase task may only enter 'in_progress' once the
-- Data Integrity Validation task for the same property is complete.
-- ---------------------------------------------------------------------------
create or replace function enforce_configuration_gate() returns trigger
language plpgsql
as $$
declare
  v_phase text;
  v_data_complete boolean;
begin
  select phase into v_phase
  from lifecycle_task_definitions
  where id = new.task_definition_id;

  if v_phase = 'configuration' then
    select (plt.status = 'complete') into v_data_complete
    from property_lifecycle_tasks plt
    join lifecycle_task_definitions d on d.id = plt.task_definition_id
    where plt.property_id = new.property_id
      and d.task_key = 'data_integrity_validation';

    if coalesce(v_data_complete, false) = false then
      raise exception 'Configuration phase is locked until Data Integrity Validation is complete.';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_configuration_gate
  before update on property_lifecycle_tasks
  for each row
  when (new.status = 'in_progress' and new.status is distinct from old.status)
  execute function enforce_configuration_gate();

-- ---------------------------------------------------------------------------
-- Gate 2: a provisioning-phase task may only enter 'in_progress' once ALL
-- configuration-phase tasks for the same property are complete.
-- ---------------------------------------------------------------------------
create or replace function enforce_provisioning_gate() returns trigger
language plpgsql
as $$
declare
  v_phase text;
begin
  select phase into v_phase
  from lifecycle_task_definitions
  where id = new.task_definition_id;

  if v_phase = 'provisioning' then
    if exists (
      select 1
      from property_lifecycle_tasks plt
      join lifecycle_task_definitions d on d.id = plt.task_definition_id
      where plt.property_id = new.property_id
        and d.phase = 'configuration'
        and plt.status <> 'complete'
    ) then
      raise exception 'Provisioning phase is locked until all Configuration tasks are complete.';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_provisioning_gate
  before update on property_lifecycle_tasks
  for each row
  when (new.status = 'in_progress' and new.status is distinct from old.status)
  execute function enforce_provisioning_gate();

-- ---------------------------------------------------------------------------
-- Gate 3: a property may only move to 'activated' once the Activation
-- Readiness Sign-off task is complete and both external IDs are set.
-- ---------------------------------------------------------------------------
create or replace function enforce_activation_gate() returns trigger
language plpgsql
as $$
declare
  v_ready boolean;
begin
  if new.salesforce_id is null or new.ingauge_id is null then
    raise exception 'Activation requires Provisioning sign-off and both Salesforce ID and IN-Gauge ID to be set.';
  end if;

  select (plt.status = 'complete') into v_ready
  from property_lifecycle_tasks plt
  join lifecycle_task_definitions d on d.id = plt.task_definition_id
  where plt.property_id = new.id
    and d.task_key = 'prov_activation_readiness';

  if coalesce(v_ready, false) = false then
    raise exception 'Activation requires Provisioning sign-off and both Salesforce ID and IN-Gauge ID to be set.';
  end if;

  return new;
end;
$$;

create trigger trg_activation_gate
  before update on properties
  for each row
  when (new.lifecycle_state = 'activated' and new.lifecycle_state is distinct from old.lifecycle_state)
  execute function enforce_activation_gate();

alter table lifecycle_task_definitions enable row level security;
alter table property_lifecycle_tasks enable row level security;
