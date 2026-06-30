-- 003_seed_roles_permissions.sql
-- Seed the 5 roles, 17 permissions and the role/permission matrix.

insert into roles (name, description) values
  ('admin', 'Full administrative access'),
  ('manager', 'Property management and oversight'),
  ('engineer', 'Technical onboarding and configuration'),
  ('operations', 'Operational setup and journaling'),
  ('viewer', 'Read-only access')
on conflict (name) do nothing;

insert into permissions (key, description) values
  ('property:create', 'Create properties'),
  ('property:read', 'Read properties'),
  ('property:update', 'Update properties'),
  ('property:archive', 'Archive properties'),
  ('task:read', 'Read lifecycle tasks'),
  ('task:update_status', 'Update lifecycle task status'),
  ('task:assign', 'Assign lifecycle tasks'),
  ('journal:read', 'Read journal entries'),
  ('journal:write', 'Create journal entries'),
  ('journal:delete_own', 'Delete own journal entries'),
  ('journal:delete_any', 'Delete any journal entry'),
  ('user:invite', 'Invite users'),
  ('user:read', 'Read users'),
  ('user:deactivate', 'Deactivate users'),
  ('brand:manage', 'Manage brands'),
  ('owner:manage', 'Manage owners'),
  ('region:manage', 'Manage regions')
on conflict (key) do nothing;

-- Role/permission matrix.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from (
  values
    -- admin: all 17 permissions
    ('admin', 'property:create'),
    ('admin', 'property:read'),
    ('admin', 'property:update'),
    ('admin', 'property:archive'),
    ('admin', 'task:read'),
    ('admin', 'task:update_status'),
    ('admin', 'task:assign'),
    ('admin', 'journal:read'),
    ('admin', 'journal:write'),
    ('admin', 'journal:delete_own'),
    ('admin', 'journal:delete_any'),
    ('admin', 'user:invite'),
    ('admin', 'user:read'),
    ('admin', 'user:deactivate'),
    ('admin', 'brand:manage'),
    ('admin', 'owner:manage'),
    ('admin', 'region:manage'),
    -- manager
    ('manager', 'property:read'),
    ('manager', 'property:update'),
    ('manager', 'task:read'),
    ('manager', 'task:update_status'),
    ('manager', 'task:assign'),
    ('manager', 'journal:read'),
    ('manager', 'journal:write'),
    ('manager', 'journal:delete_own'),
    ('manager', 'user:read'),
    -- operations
    ('operations', 'property:read'),
    ('operations', 'task:read'),
    ('operations', 'task:update_status'),
    ('operations', 'journal:read'),
    ('operations', 'journal:write'),
    ('operations', 'journal:delete_own'),
    -- engineer
    ('engineer', 'property:read'),
    ('engineer', 'task:read'),
    ('engineer', 'task:update_status'),
    ('engineer', 'journal:read'),
    ('engineer', 'journal:write'),
    ('engineer', 'journal:delete_own'),
    -- viewer
    ('viewer', 'property:read'),
    ('viewer', 'task:read'),
    ('viewer', 'journal:read')
) as m(role_name, permission_key)
join roles r on r.name = m.role_name
join permissions p on p.key = m.permission_key
on conflict do nothing;
