-- RealEstate CRM: support merged units in the shakhmatka grid,
-- and stop defaulting SMS sender name to an unrelated placeholder.

alter table crm.objects add column if not exists span integer not null default 1;

alter table crm.settings alter column sms_sender_name drop default;
update crm.settings set sms_sender_name = null where sms_sender_name = 'BurjiBohtar';
