-- Split the single government ID upload into front and back (both required).
INSERT INTO "document_types" ("key", "label", "description", "is_active", "sort_order")
VALUES
  ('government_id_front', 'Government-issued ID (front)', 'The front of your passport photo page, national ID card or driving licence. All corners visible.', true, 0),
  ('government_id_back', 'Government-issued ID (back)', 'The back of your national ID card or driving licence. Using a passport? Upload the page with your signature.', true, 1)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
UPDATE "loan_products"
SET "required_document_types" = array_replace("required_document_types", 'government_id', 'government_id_front')
WHERE 'government_id' = ANY("required_document_types");
--> statement-breakpoint
-- Keep the old type (existing uploads still reference it) but stop offering it.
UPDATE "document_types" SET "is_active" = false WHERE "key" = 'government_id';
