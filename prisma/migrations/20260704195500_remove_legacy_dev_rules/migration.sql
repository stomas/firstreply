DELETE FROM "decision_requirements"
WHERE "client_id" = '1'
  AND "id" LIKE 'req_dev_%';

DELETE FROM "pricing_rules"
WHERE "client_id" = '1'
  AND "id" LIKE 'price_dev_%';
