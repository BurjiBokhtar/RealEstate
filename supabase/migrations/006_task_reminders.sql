-- RealEstate CRM: optional SMS reminders for task due dates

alter table crm.tasks add column if not exists assignee_phone text;
alter table crm.tasks add column if not exists reminder_sent_at timestamptz;
