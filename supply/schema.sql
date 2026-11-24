-- Proposed PostgreSQL schema. Not yet applied to a production database.
-- Private server-only access required; do not expose invoice data through anonymous APIs.
BEGIN;
CREATE SCHEMA IF NOT EXISTS supply;
REVOKE ALL ON SCHEMA supply FROM PUBLIC;
CREATE TABLE supply.points(id text PRIMARY KEY, name text NOT NULL);
INSERT INTO supply.points VALUES ('baumana','Баумана 18'),('plasma','Плазма'),('gs','Героев Североморцев'),('pz','Полярные Зори');
CREATE TABLE supply.suppliers(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL, inn text UNIQUE);
CREATE TABLE supply.comparison_groups(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL, specification text NOT NULL, unit text NOT NULL CHECK(unit IN ('кг','л','шт')), UNIQUE(name,specification,unit));
CREATE TABLE supply.products(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, group_id bigint NOT NULL REFERENCES supply.comparison_groups, name text NOT NULL, brand text NOT NULL, specification text NOT NULL, UNIQUE(group_id,name,brand,specification));
CREATE TABLE supply.aliases(supplier_id bigint NOT NULL REFERENCES supply.suppliers, source_name text NOT NULL, product_id bigint NOT NULL REFERENCES supply.products, approved_by text NOT NULL, PRIMARY KEY(supplier_id,source_name));
CREATE TABLE supply.invoices(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, supplier_id bigint REFERENCES supply.suppliers, point_id text REFERENCES supply.points, number text, invoice_date date, gross_total numeric(15,2) CHECK(gross_total>=0), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','confirmed','archived')), confirmed_by text, created_at timestamptz NOT NULL DEFAULT now(), CHECK(status<>'confirmed' OR (supplier_id IS NOT NULL AND point_id IS NOT NULL AND nullif(btrim(number),'') IS NOT NULL AND invoice_date IS NOT NULL AND gross_total IS NOT NULL AND confirmed_by IS NOT NULL)));
CREATE UNIQUE INDEX supply_invoice_unique ON supply.invoices(supplier_id,lower(btrim(number)),invoice_date,point_id) WHERE status='confirmed';
CREATE TABLE supply.documents(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, invoice_id bigint NOT NULL REFERENCES supply.invoices, private_object_key text NOT NULL UNIQUE, sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'), telegram_chat_id text, telegram_message_id text, UNIQUE(telegram_chat_id,telegram_message_id));
CREATE TABLE supply.lines(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, invoice_id bigint NOT NULL REFERENCES supply.invoices, source_name text NOT NULL, product_id bigint REFERENCES supply.products, quantity numeric(15,5) CHECK(quantity>0), unit text, pack_size numeric(15,5) CHECK(pack_size>0), pack_unit text, gross_total numeric(15,2) CHECK(gross_total>0), vat_rate numeric(5,2) CHECK(vat_rate BETWEEN 0 AND 100), normalized_quantity numeric(15,5) CHECK(normalized_quantity>0), normalized_unit text CHECK(normalized_unit IN ('кг','л','шт')), status text NOT NULL DEFAULT 'review' CHECK(status IN ('review','confirmed')), confidence numeric(5,4) CHECK(confidence BETWEEN 0 AND 1), CHECK(status<>'confirmed' OR (product_id IS NOT NULL AND quantity IS NOT NULL AND gross_total IS NOT NULL AND normalized_quantity IS NOT NULL AND normalized_unit IS NOT NULL)));
CREATE INDEX supply_line_product ON supply.lines(product_id,invoice_id);
CREATE TABLE supply.audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, entity_type text NOT NULL, entity_id bigint NOT NULL, action text NOT NULL, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), details jsonb NOT NULL DEFAULT '{}');
REVOKE ALL ON ALL TABLES IN SCHEMA supply FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA supply FROM PUBLIC;
COMMIT;
