-- Remove the inferred user operating experience batch created before explicit user entry.
-- Idempotent cleanup: safe whether 0093 was applied or not.
DELETE FROM knowledge_items
WHERE knowledge_id IN (
  'KB-ADS-0001',
  'KB-ADS-0002',
  'KB-ADS-0003',
  'KB-PRI-0001',
  'KB-CAS-0001',
  'KB-DEC-0001',
  'KB-CAS-0002',
  'KB-CON-0001'
);
