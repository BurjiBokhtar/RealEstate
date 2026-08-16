-- ============================================================
-- 051: фильтр по ЖК доходит до таблицы «Продажи по менеджерам».
--
-- ЧТО БЫЛО НЕ ТАК. В шапке дашборда есть выбор ЖК, и ему подчиняется
-- каждая цифра на странице — кроме таблицы «Продажи по менеджерам».
-- Она звала sales_by_manager(p_from, p_to): дат достаточно, а ЖК
-- передать некуда. Получалось, что при выбранном одном ЖК верх
-- страницы показывает его, а таблица менеджеров — по-прежнему все
-- объекты. Две половины одного экрана отвечали на разные вопросы, и
-- цифры под ними не сходились.
--
-- Функция получает третий параметр. Старая двухпараметрная версия
-- удаляется, а не остаётся рядом: оставить её — значит оставить и
-- способ позвать таблицу без фильтра.
--
-- Соединение с objects внутреннее, и это безопасно: contracts.object_id
-- объявлен NOT NULL с внешним ключом, так что ни одна строка на нём не
-- потеряется.
--
-- Идемпотентно: drop … if exists перед create, повторный запуск
-- безопасен.
-- ============================================================

drop function if exists crm.sales_by_manager(date, date);

create or replace function crm.sales_by_manager(
  p_from date default null,
  p_to date default null,
  p_building_id uuid default null
)
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
    join crm.objects o on o.id = c.object_id
    left join auth.users u on u.id = c.created_by
    where c.status <> 'cancelled'
      and (p_from is null or c.signed_date >= p_from)
      and (p_to is null or c.signed_date <= p_to)
      and (p_building_id is null or o.building_id = p_building_id)
    group by 1, 2
    order by 4 desc nulls last;
end;
$$;

grant execute on function crm.sales_by_manager(date, date, uuid) to authenticated;
