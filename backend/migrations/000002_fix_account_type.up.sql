-- Fix account type constraint: rename 'bank_account' → 'bank' to match frontend model
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('cash','bank','credit_card','investment','savings','other'));
