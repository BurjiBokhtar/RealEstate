"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ClientForm } from "@/components/ClientForm";
import { ClientQuickPayment } from "@/components/ClientQuickPayment";
import { formatCurrency, type Currency } from "@/lib/currency";
import { receiptNumberFor } from "@/lib/contracts/receiptNumber";
import { CONTRACT_STATUS_COLORS } from "@/lib/contracts/format";
import type { Client, ClientInput } from "@/lib/clients/types";
import type { ContractPayment, ContractStatus } from "@/lib/contracts/types";

type ClientContract = {
  id: string;
  number: string | null;
  amount: number;
  paid_amount: number;
  currency: Currency;
  status: ContractStatus;
  signed_date: string | null;
  object: { name: string; building: { name: string } | null } | null;
};

export default function ClientDetailPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();

  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [interestedObject, setInterestedObject] = useState<{
    id: string;
    name: string;
    building_id: string | null;
  } | null>(null);
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadContracts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .schema("crm")
      .from("contracts")
      .select(
        "id, number, amount, paid_amount, currency, status, signed_date, object:objects(name, building:buildings(name))"
      )
      .eq("client_id", params.id)
      .order("signed_date", { ascending: false });
    setContracts((data ?? []) as unknown as ClientContract[]);
  }, [params.id]);

  useEffect(() => {
    if (!configured) {
      setClient(null);
      return;
    }
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("clients")
      .select("*")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data }) => {
        const c = (data as Client) ?? null;
        setClient(c);
        if (c?.interested_object_id) {
          supabase
            .schema("crm")
            .from("objects")
            .select("id, name, building_id")
            .eq("id", c.interested_object_id)
            .maybeSingle()
            .then(({ data: obj }) => setInterestedObject(obj ?? null));
        } else {
          setInterestedObject(null);
        }
      });
    loadContracts();
  }, [configured, params.id, loadContracts]);

  useEffect(() => {
    if (contracts.length === 0) {
      setPayments([]);
      return;
    }
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("contract_payments")
      .select("*")
      .in(
        "contract_id",
        contracts.map((c) => c.id)
      )
      .then(({ data }) => {
        const rows = (data ?? []) as ContractPayment[];
        rows.sort((a, b) => (b.paid_date ?? b.due_date).localeCompare(a.paid_date ?? a.due_date));
        setPayments(rows);
      });
  }, [contracts]);

  const handleSubmit = async (values: ClientInput) => {
    setSubmitting(true);
    const supabase = createClient();
    await supabase
      .schema("crm")
      .from("clients")
      .update({
        name: values.name,
        phone: values.phone || null,
        email: values.email || null,
        passport: values.passport || null,
        passport_issued_by: values.passport_issued_by || null,
        birth_date: values.birth_date || null,
        address: values.address || null,
        source: values.source || null,
        status: values.status,
        interested_object_id: values.interested_object_id || null,
        notes: values.notes || null,
      })
      .eq("id", params.id);
    setSubmitting(false);
    router.push("/clients");
  };

  const handleDelete = async () => {
    if (!window.confirm(t.clients.form.confirmDelete)) return;
    setDeleteError(null);
    const supabase = createClient();
    const { error } = await supabase.schema("crm").from("clients").delete().eq("id", params.id);
    if (error) {
      setDeleteError(t.clients.form.deleteBlocked);
      return;
    }
    router.push("/clients");
  };

  const totalDebt = contracts.reduce((sum, c) => {
    if (c.status === "cancelled") return sum;
    return sum + Math.max(0, c.amount - c.paid_amount);
  }, 0);

  const paymentsByContract = payments.reduce<Record<string, ContractPayment[]>>((acc, p) => {
    (acc[p.contract_id] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <Link href="/clients" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.clients.backToList}
      </Link>

      {!configured && <SetupNotice />}

      {configured && client === undefined && (
        <p className="text-slate-400">{t.common.loading}</p>
      )}
      {configured && client === null && (
        <p className="text-slate-400">{t.clients.notFound}</p>
      )}

      {client && (
        <>
          <h1 className="text-2xl font-semibold">{client.name}</h1>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div className="flex flex-col gap-3">
              <ClientForm
                initial={{
                  name: client.name,
                  phone: client.phone ?? "",
                  email: client.email ?? "",
                  passport: client.passport ?? "",
                  passport_issued_by: client.passport_issued_by ?? "",
                  birth_date: client.birth_date ?? "",
                  address: client.address ?? "",
                  source: client.source ?? "",
                  status: client.status,
                  interested_object_id: client.interested_object_id ?? "",
                  notes: client.notes ?? "",
                }}
                submitting={submitting}
                onSubmit={handleSubmit}
                onDelete={handleDelete}
              />
              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            </div>

            <ClientQuickPayment contracts={contracts} onRecorded={loadContracts} />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:items-start">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700">
                  {t.clients.purchases.title}
                </p>
                {totalDebt > 0 && (
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
                    {t.clients.purchases.totalDebt}:{" "}
                    {formatCurrency(totalDebt, contracts[0]?.currency ?? "TJS")}
                  </span>
                )}
              </div>
              {contracts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-400">
                    🏠
                  </span>
                  <p className="text-sm text-slate-400">{t.clients.purchases.empty}</p>
                  {interestedObject && (
                    <p className="text-sm text-slate-500">
                      {t.clients.purchases.interestedIn}{" "}
                      <Link
                        href={
                          interestedObject.building_id
                            ? `/buildings/${interestedObject.building_id}`
                            : "/buildings"
                        }
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {interestedObject.name} → {t.dashboard.hero.cta}
                      </Link>
                    </p>
                  )}
                </div>
              ) : (
                <div className="-mx-5 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-5 py-2.5 font-medium">{t.clients.purchases.object}</th>
                        <th className="px-3 py-2.5 font-medium">{t.contracts.form.status}</th>
                        <th className="px-3 py-2.5 font-medium">{t.contracts.form.amount}</th>
                        <th className="px-3 py-2.5 font-medium">
                          {t.contracts.form.paidAmount}
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          {t.buildings.hover.remaining}
                        </th>
                        <th className="px-3 py-2.5 text-center font-medium">
                          {t.clients.purchases.paymentsCount}
                        </th>
                        <th className="px-5 py-2.5 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((c) => {
                        const remaining = c.amount - c.paid_amount;
                        const paidCount = (paymentsByContract[c.id] ?? []).filter(
                          (p) => p.paid
                        ).length;
                        return (
                          <tr key={c.id} className="border-b border-slate-100 last:border-0">
                            <td className="px-5 py-3">
                              <Link
                                href={`/contracts/${c.id}`}
                                className="font-medium text-slate-900 hover:underline"
                              >
                                {c.object?.name ?? "—"}
                              </Link>
                              {c.object?.building && (
                                <span className="block text-xs text-slate-400">
                                  {c.object.building.name}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONTRACT_STATUS_COLORS[c.status]}`}
                              >
                                {t.contracts.statuses[c.status]}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-700">
                              {formatCurrency(c.amount, c.currency)}
                            </td>
                            <td className="px-3 py-3 font-medium text-emerald-600">
                              {formatCurrency(c.paid_amount, c.currency)}
                            </td>
                            <td className="px-3 py-3 font-medium text-rose-600">
                              {remaining > 0 ? formatCurrency(remaining, c.currency) : "—"}
                            </td>
                            <td className="px-3 py-3 text-center text-slate-600">{paidCount}</td>
                            <td className="px-5 py-3 text-right">
                              <Link
                                href={`/contracts/${c.id}/payments`}
                                className="text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline"
                              >
                                {t.clients.purchases.pay} →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">
                {t.clients.paymentHistory.title}
              </p>
              {payments.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-400">
                    🧾
                  </span>
                  <p className="text-sm text-slate-400">{t.clients.paymentHistory.empty}</p>
                </div>
              ) : (
                <div className="-mx-5 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-5 py-2.5 font-medium">
                          {t.clients.paymentHistory.receiptNo}
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          {t.clients.paymentHistory.date}
                        </th>
                        <th className="px-3 py-2.5 font-medium">{t.clients.purchases.object}</th>
                        <th className="px-3 py-2.5 font-medium">
                          {t.contracts.payments.amount}
                        </th>
                        <th className="px-3 py-2.5 font-medium">{t.contracts.payments.paid}</th>
                        <th className="px-5 py-2.5 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => {
                        const c = contracts.find((cc) => cc.id === p.contract_id);
                        return (
                          <tr key={p.id} className="border-b border-slate-100 last:border-0">
                            <td className="px-5 py-3 text-slate-400">
                              №{receiptNumberFor(paymentsByContract[p.contract_id] ?? [], p.id)}
                            </td>
                            <td className="px-3 py-3 text-slate-700">
                              {p.paid_date ?? p.due_date}
                            </td>
                            <td className="px-3 py-3">
                              <Link
                                href={`/contracts/${p.contract_id}`}
                                className="text-slate-700 hover:underline"
                              >
                                {c?.object?.name ?? "—"}
                              </Link>
                            </td>
                            <td className="px-3 py-3 font-medium text-slate-900">
                              {formatCurrency(p.amount, c?.currency ?? "TJS")}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                  p.paid
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {p.paid
                                  ? t.clients.paymentHistory.paid
                                  : t.clients.paymentHistory.unpaid}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Link
                                href={`/contracts/${p.contract_id}/payments/${p.id}/receipt`}
                                className="text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline"
                              >
                                {t.contracts.receipt.print} →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
