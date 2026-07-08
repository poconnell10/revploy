-- 016_add_management_company_owner_type.sql
-- Add 'management_company' as an allowed owner_type by widening the CHECK
-- constraint on owners.owner_type.

ALTER TABLE owners DROP CONSTRAINT IF EXISTS owners_owner_type_check;
ALTER TABLE owners ADD CONSTRAINT owners_owner_type_check
CHECK (owner_type IN ('reit', 'pe_fund', 'independent', 'other', 'management_company'));
