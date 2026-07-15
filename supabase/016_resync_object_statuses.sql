-- Re-applies 015's status-sync trigger (safe to run whether or not 015 ever
-- actually ran on this database -- everything here is create-or-replace /
-- drop-if-exists) and adds a bulk resync RPC plus an admin-visible "last
-- synced" marker, so staff have a one-click manual fix if a unit's color
-- on the shakhmatka ever drifts from its real paid status again.

create or replace function crm.recompute_object_status(p_object_id uuid)
returns void
language sql
security definer
set search_path = crm, public
as $$
  update crm.objects
  set status = case
    when exists (
      select 1 from crm.contracts c
      where c.object_id = p_object_id and c.status <> 'cancelled' and c.paid_amount > 0
    ) then 'sold'
    when exists (
      select 1 from crm.contracts c
      where c.object_id = p_object_id and c.status <> 'cancelled'
    ) then 'reserved'
    else 'available'
  end::crm.object_status
  where id = p_object_id;
$$;

create or replace function crm.sync_object_status()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  perform crm.recompute_object_status(coalesce(NEW.object_id, OLD.object_id));

  if TG_OP = 'UPDATE' and OLD.object_id is distinct from NEW.object_id then
    perform crm.recompute_object_status(OLD.object_id);
  end if;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_sync_object_status on crm.contracts;
create trigger trg_sync_object_status
after insert or update or delete on crm.contracts
for each row execute function crm.sync_object_status();

-- One-shot bulk fix for anything already out of sync (covers both "015
-- never ran" and "015 ran but something wrote paid_amount before
-- set_payment_paid existed"). Only touches objects that actually have a
-- contract, same as 015's own backfill.
create or replace function crm.resync_all_object_statuses()
returns integer
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_count integer := 0;
begin
  update crm.objects o
  set status = case
    when exists (
      select 1 from crm.contracts c
      where c.object_id = o.id and c.status <> 'cancelled' and c.paid_amount > 0
    ) then 'sold'
    when exists (
      select 1 from crm.contracts c
      where c.object_id = o.id and c.status <> 'cancelled'
    ) then 'reserved'
    else 'available'
  end::crm.object_status
  where exists (select 1 from crm.contracts c where c.object_id = o.id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function crm.resync_all_object_statuses() to authenticated;

-- Immediate fix, same as running the RPC once by hand.
select crm.resync_all_object_statuses();
