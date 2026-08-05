-- ============================================================
-- 037: «Продажи по менеджерам» — фильтр по периоду.
--
-- crm.sales_by_manager() пересоздаётся с двумя необязательными
-- параметрами (p_from, p_to по signed_date). При NULL ведёт себя как
-- раньше -- без фильтра, вся история. Старая версия без аргументов
-- удаляется явно: иначе Postgres считает вызов sales_by_manager() без
-- скобочных аргументов неоднозначным (обе сигнатуры подходят, у новой
-- ведь оба параметра со значением по умолчанию).
--
-- Файл идемпотентный -- можно запускать повторно.
-- ============================================================

drop function if exists crm.sales_by_manager();

create or replace function crm.sales_by_manager(p_from date default null, p_to date default null)
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
      and (p_from is null or c.signed_date >= p_from)
      and (p_to is null or c.signed_date <= p_to)
    group by 1, 2
    order by 4 desc nulls last;
end;
$$;

grant execute on function crm.sales_by_manager(date, date) to authenticated;
