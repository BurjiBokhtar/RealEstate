-- Keep the event journal from growing forever. Entries older than 14 days are
-- pruned automatically, triggered whenever a new event is logged (statement
-- level, so it runs once per insert, not per row). An index on created_at
-- keeps both the prune and the newest-first listing fast.
create index if not exists audit_log_created_at_idx on crm.audit_log (created_at);

create or replace function crm.prune_audit_log()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  delete from crm.audit_log where created_at < now() - interval '14 days';
  return null;
end;
$$;

drop trigger if exists trg_prune_audit_log on crm.audit_log;
create trigger trg_prune_audit_log
after insert on crm.audit_log
for each statement execute function crm.prune_audit_log();
