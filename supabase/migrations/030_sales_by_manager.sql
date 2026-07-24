-- ============================================================
-- 030: продажи по менеджерам.
--
-- 1) В договоре появляется поле created_by — кто оформил сделку.
--    Заполняется САМО при создании (триггер ставит текущего
--    пользователя), менять ввод в программе не нужно. Старые договоры
--    останутся без менеджера ("Без менеджера" в отчёте).
-- 2) RPC crm.sales_by_manager() — сводка для дашборда: по каждому
--    менеджеру число сделок, сумма договоров и сколько оплачено, в
--    разрезе валют. Только админ и директор.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

alter table crm.contracts
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Проставлять автора при вставке (все пути создания договора идут от
-- имени вошедшего пользователя).
create or replace function crm.set_contract_creator()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_contract_creator on crm.contracts;
create trigger trg_set_contract_creator
before insert on crm.contracts
for each row execute function crm.set_contract_creator();

-- Сводка продаж по менеджерам. Читает auth.users (email), поэтому
-- SECURITY DEFINER и только для админа/директора.
create or replace function crm.sales_by_manager()
returns table (
  manager text,
  currency text,
  contracts bigint,
  total numeric,
  paid numeric
)
language plpgsql
security definer
set search_path = crm, public, auth
stable
as $$
begin
  if not (crm.is_admin() or crm.is_director()) then
    raise exception 'Доступно только администратору и директору';
  end if;
  return query
    select
      coalesce(u.email::text, 'Без менеджера') as manager,
      c.currency::text as currency,
      count(*)::bigint as contracts,
      sum(c.amount) as total,
      sum(least(c.paid_amount, c.amount)) as paid
    from crm.contracts c
    left join auth.users u on u.id = c.created_by
    where c.status <> 'cancelled'
    group by 1, 2
    order by 4 desc nulls last;
end;
$$;

grant execute on function crm.sales_by_manager() to authenticated;
