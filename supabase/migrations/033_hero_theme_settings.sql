-- Company-wide dashboard hero look. The admin picks a colour theme and an
-- ornament pattern in Settings; it applies for everyone who hasn't set a
-- personal (device-local) override. Nullable text -- null means the built-in
-- default ("atlas" / no pattern). Settings updates are already admin-only.

alter table crm.settings add column if not exists hero_theme text;
alter table crm.settings add column if not exists hero_pattern text;
