-- ============================================================
-- 023: каскадное удаление клиента админом.
--
-- Обычное удаление клиента заблокировано, если у него есть договоры
-- (и это правильно). Этот RPC — осознанное действие админа: удаляет
-- клиента ВМЕСТЕ со всеми его договорами и платежами, одной
-- транзакцией. Роль проверяется здесь, в базе, а не в браузере.
--
-- Каждая удалённая строка попадает в журнал событий (audit_log)
-- через существующие триггеры log_delete, так что «что именно
-- удалили» восстановимо из журнала. Статусы квартир пересчитаются
-- сами: триггер на удаление договора уже это делает.
--
-- Файл идемпотентный — можно запускать повторно.
-- ============================================================

create or replace function crm.delete_client_cascade(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_contracts integer := 0;
  v_payments integer := 0;
begin
  if not crm.is_admin() then
    raise exception 'Только администратор может удалять клиентов';
  end if;

  delete from crm.contract_payments cp
  using crm.contracts c
  where cp.contract_id = c.id and c.client_id = p_client_id;
  get diagnostics v_payments = row_count;

  delete from crm.contracts where client_id = p_client_id;
  get diagnostics v_contracts = row_count;

  delete from crm.clients where id = p_client_id;

  return jsonb_build_object('contracts', v_contracts, 'payments', v_payments);
end;
$$;

grant execute on function crm.delete_client_cascade(uuid) to authenticated;
