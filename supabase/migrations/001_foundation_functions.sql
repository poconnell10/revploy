-- 001_foundation_functions.sql
-- Foundation functions: UUID v7 generation, display-code counter, RBAC helpers,
-- and the single event-outbox write path.
--
-- All table-referencing functions are written in PL/pgSQL so that their bodies
-- are resolved at execution time, not at CREATE time. This lets them reference
-- tables (id_sequences, event_outbox, the RBAC tables, properties) that are
-- created in later migrations.

-- ---------------------------------------------------------------------------
-- uuidv7(): RFC 9562 version-7 UUID (time-ordered).
-- Takes a random v4 UUID, overlays the high 48 bits with the current Unix
-- timestamp in milliseconds, then forces the version nibble to 7. The variant
-- bits produced by gen_random_uuid() already satisfy RFC 9562.
-- ---------------------------------------------------------------------------
create or replace function uuidv7() returns uuid
language sql
volatile
as $$
  select encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(
            int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint)
            from 3
          )
          from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$;

-- ---------------------------------------------------------------------------
-- generate_display_code(prefix): atomic, gap-tolerant human-readable code.
-- Uses the id_sequences table as a per-prefix counter. The UPDATE takes a row
-- lock, so concurrent callers are serialized and never receive the same value.
-- First code for a prefix is PREFIX-000001.
-- ---------------------------------------------------------------------------
create or replace function generate_display_code(prefix text) returns text
language plpgsql
as $$
#variable_conflict use_variable
declare
  v_val bigint;
begin
  insert into id_sequences (prefix, next_val)
  values (prefix, 1)
  on conflict (prefix) do nothing;

  update id_sequences
    set next_val = id_sequences.next_val + 1
    where id_sequences.prefix = generate_display_code.prefix
    returning id_sequences.next_val - 1 into v_val;

  return prefix || '-' || lpad(v_val::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- has_permission(user_id, permission_key, property_id): SECURITY DEFINER.
-- True if the user holds any role granting permission_key whose scope applies:
--   * global scope                      -> always applies
--   * property scope                    -> scope_id = property_id
--   * region scope                      -> scope_id = the property's region_id
-- ---------------------------------------------------------------------------
create or replace function has_permission(
  user_id uuid,
  permission_key text,
  property_id uuid default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_region_id uuid;
  v_has boolean;
begin
  if property_id is not null then
    select p.region_id into v_region_id from properties p where p.id = property_id;
  end if;

  select exists (
    select 1
    from user_role_assignments ura
    join role_permissions rp on rp.role_id = ura.role_id
    join permissions perm on perm.id = rp.permission_id
    where ura.user_id = user_id
      and perm.key = permission_key
      and (
        ura.scope_type = 'global'
        or (ura.scope_type = 'property' and ura.scope_id = property_id)
        or (ura.scope_type = 'region' and v_region_id is not null and ura.scope_id = v_region_id)
      )
  ) into v_has;

  return coalesce(v_has, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_user_role(user_id): SECURITY DEFINER.
-- Returns the name of the user's most-privileged assigned role (admin first),
-- or null if the user has no role assignments.
-- ---------------------------------------------------------------------------
create or replace function get_user_role(user_id uuid) returns text
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_role text;
begin
  select r.name into v_role
  from user_role_assignments ura
  join roles r on r.id = ura.role_id
  where ura.user_id = user_id
  order by case r.name
      when 'admin' then 1
      when 'manager' then 2
      when 'engineer' then 3
      when 'operations' then 4
      when 'viewer' then 5
      else 6
    end
  limit 1;

  return v_role;
end;
$$;

-- ---------------------------------------------------------------------------
-- dispatch_event(event_type, payload): SECURITY DEFINER.
-- The sole write path to event_outbox. Inserts one row and returns void.
-- ---------------------------------------------------------------------------
create or replace function dispatch_event(event_type text, payload jsonb) returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
begin
  insert into event_outbox (event_type, payload)
  values (event_type, payload);
end;
$$;
