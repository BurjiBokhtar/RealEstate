-- RealEstate CRM: company logo, block/entrance support for shakhmatka,
-- and editable SMS templates.

alter table crm.settings add column if not exists company_logo_url text;
alter table crm.settings add column if not exists sms_payment_template text;
alter table crm.settings add column if not exists sms_task_template text;

alter table crm.objects add column if not exists block text;

update crm.settings
set sms_payment_template = $tpl$Уважаемый(ая) {{client_name}}, напоминаем: оплата {{amount}} {{currency}} по договору №{{contract_number}} до {{due_date}}.$tpl$
where sms_payment_template is null;

update crm.settings
set sms_task_template = $tpl${{assignee}}, напоминаем: задача "{{title}}" — срок {{due_date}}.$tpl$
where sms_task_template is null;
