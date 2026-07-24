-- RealEstate CRM: per-deal currency (no auto-conversion), editable contract
-- template + company info, and non-apartment unit types (parking/commercial).

-- ===== Currency per object / per contract =====

create type crm.currency as enum ('TJS', 'USD');

alter table crm.objects add column if not exists currency crm.currency not null default 'TJS';
alter table crm.contracts add column if not exists currency crm.currency not null default 'TJS';
alter table crm.contracts add column if not exists amount_words text;

-- ===== Client passport (needed by the sample contract text) =====

alter table crm.clients add column if not exists passport text;

-- ===== Non-apartment unit types for the shakhmatka (basement/parking, etc.) =====

alter type crm.object_type add value if not exists 'parking';

-- ===== Company info + editable contract template =====

alter table crm.settings add column if not exists company_name text;
alter table crm.settings add column if not exists company_director text;
alter table crm.settings add column if not exists company_address text;
alter table crm.settings add column if not exists company_bank_details text;
alter table crm.settings add column if not exists contract_template text;
