"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BackLink } from "@/components/BackLink";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ClientForm } from "@/components/ClientForm";
import { ClientQuickPayment } from "@/components/ClientQuickPayment";
import { Toast, type ToastType } from "@/components/Toast";
import { formatCurrency, type Currency } from "@/lib/currency";
import { formatShortDate } from "@/lib/formatDate";
import { MoneyPairValue, type MoneyPair } from "@/components/MoneyPairValue";
import { receiptNumberFor } from "@/lib/contracts/receiptNumber";
import { CONTRACT_STATUS_COLORS } from "@/lib/contracts/format";
import { useRole } from "@/lib/auth/useRole";
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

// Small outline icons for the profile info tiles (currentColor, one weight).
const FIELD_ICONS: Record<string, ReactNode> = {
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 4.5 4.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z"/></svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/></svg>
  ),
  passport: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M9 16h6"/></svg>
  ),
  office: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2"/></svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
  ),
  note: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M8 13h8M8 17h5"/></svg>
  ),
};

// Everything front-desk work with one client needs, on one screen: who they
// are (compact card, edit tucked away behind a button), take a payment and
// print its receipt, their apartments with contract print / cash-desk
// shortcuts, and the full receipt history with reprints.
export default function ClientDetailPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();
  const { role } = useRole();

  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [interestedObject, setInterestedObject] = useState<{
    id: string;
    name: string;
    building_id: string | null;
  } | null>(null);
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  // Cascade-delete confirmation: open flag + the name the admin has typed.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string | null; type: ToastType }>({
    message: null,
    type: "success",
  });

  const loadClient = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .schema("crm")
      .from("clients")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    const c = (data as Client) ?? null;
    setClient(c);
    if (c?.interested_object_id) {
      const { data: obj } = await supabase
        .schema("crm")
        .from("objects")
        .select("id, name, building_id")
        .eq("id", c.interested_object_id)
        .maybeSingle();
      setInterestedObject(obj ?? null);
    } else {
      setInterestedObject(null);
    }
  }, [params.id]);

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
    loadClient();
    loadContracts();
  }, [configured, loadClient, loadContracts]);

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

  // The history block shows money actually received -- real receipts, in
  // the order they happened. The unpaid future installments belong to the
  // schedule on the contract's cash-desk page, not here; mixing them in
  // made the history read as a wall of "not paid" rows.
  const paidPayments = payments.filter((p) => p.paid);

  const handleSubmit = async (values: ClientInput) => {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase
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
        interested_object_id: values.interested_object_id || null,
        notes: values.notes || null,
      })
      .eq("id", params.id);
    setSubmitting(false);
    if (error) {
      setToast({ message: error.message, type: "error" });
      return;
    }
    // Stay on the hub: fold the form away and show the fresh data instead
    // of bouncing the user back to the list mid-conversation with a client.
    setEditing(false);
    setToast({ message: t.clients.profile.saved, type: "success" });
    await loadClient();
  };

  // Deleting a client takes their contracts and payments with them, so a
  // browser confirm() is not enough ceremony: the modal spells out what
  // goes, and the admin must retype the client's name. The role check that
  // matters lives in the delete_client_cascade RPC, in the database.
  const handleDelete = () => {
    setDeleteTyped("");
    setDeleteOpen(true);
  };

  const confirmCascadeDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .schema("crm")
      .rpc("delete_client_cascade", { p_client_id: params.id });
    setDeleting(false);
    if (error) {
      setToast({ message: error.message, type: "error" });
      return;
    }
    router.push("/clients");
  };

  const totalDebt = contracts.reduce((sum, c) => {
    if (c.status === "cancelled") return sum;
    return sum + Math.max(0, c.amount - c.paid_amount);
  }, 0);

  // Contracts can be in TJS or USD -- sum each currency separately and show
  // both when both occur (same convention as the dashboard).
  const moneyPair = (pick: (c: ClientContract) => number): MoneyPair => {
    const v = { tjs: 0, usd: 0 };
    contracts
      .filter((c) => c.status !== "cancelled")
      .forEach((c) => {
        if (c.currency === "USD") v.usd += pick(c);
        else v.tjs += pick(c);
      });
    return v;
  };
  const activeContracts = contracts.filter((c) => c.status !== "cancelled");
  const statTiles: Array<{ label: string; value: ReactNode; tone: string }> = [
    {
      label: t.clients.stats.bought,
      value: String(activeContracts.length),
      tone: "text-slate-900",
    },
    {
      label: t.clients.stats.paidTotal,
      value: <MoneyPairValue value={moneyPair((c) => c.paid_amount)} />,
      tone: "text-emerald-600",
    },
    {
      label: t.clients.stats.debt,
      value: (
        <MoneyPairValue value={moneyPair((c) => Math.max(0, c.amount - c.paid_amount))} />
      ),
      tone: totalDebt > 0 ? "text-rose-600" : "text-emerald-600",
    },
  ];

  const readOnly = role === "director";

  const paymentsByContract = payments.reduce<Record<string, ContractPayment[]>>((acc, p) => {
    (acc[p.contract_id] ??= []).push(p);
    return acc;
  }, {});

  const profileFields: Array<{
    label: string;
    value: string | null;
    href?: string;
    icon: ReactNode;
  }> = client
    ? [
        {
          label: t.clients.form.phone,
          value: client.phone,
          href: client.phone ? `tel:${client.phone.replace(/\s/g, "")}` : undefined,
          icon: FIELD_ICONS.phone,
        },
        {
          label: t.clients.form.email,
          value: client.email,
          href: client.email ? `mailto:${client.email}` : undefined,
          icon: FIELD_ICONS.email,
        },
        { label: t.clients.form.passport, value: client.passport, icon: FIELD_ICONS.passport },
        {
          label: t.clients.form.passportIssuedBy,
          value: client.passport_issued_by,
          icon: FIELD_ICONS.office,
        },
        { label: t.clients.form.birthDate, value: client.birth_date, icon: FIELD_ICONS.calendar },
        { label: t.clients.form.address, value: client.address, icon: FIELD_ICONS.pin },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/clients">{t.clients.backToList}</BackLink>

      {!configured && <SetupNotice />}

      {configured && client === undefined && (
        <p className="text-slate-400">{t.common.loading}</p>
      )}
      {configured && client === null && (
        <p className="text-slate-400">{t.clients.notFound}</p>
      )}

      {client && (
        <>
          {/* Client state at a glance -- same tile language as the cash desk */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {statTiles.map((tile, i) => (
              <div
                key={tile.label}
                style={{ animationDelay: `${i * 50}ms` }}
                className="animate-fade-up rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  {tile.label}
                </p>
                <div className={`mt-1 text-2xl font-bold tabular-nums ${tile.tone}`}>
                  {tile.value}
                </div>
              </div>
            ))}
          </div>

          <div
            className={`grid grid-cols-1 gap-5 lg:items-start ${
              readOnly ? "" : "lg:grid-cols-[minmax(0,1fr)_360px]"
            }`}
          >
            {/* Profile card: everything at a glance, edit folded away */}
            <div
              className="animate-fade-up flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              style={{ animationDelay: "150ms" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <span className="hero-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ring-2 ring-white ring-offset-2 ring-offset-slate-50">
                    {client.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold leading-tight">{client.name}</h1>
                    {(client.phone || client.source) && (
                      <p className="mt-0.5 truncate text-sm text-slate-400">
                        {[client.phone, client.source].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing((v) => !v)}
                      className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98]"
                    >
                      {editing ? t.clients.profile.hideForm : t.clients.profile.edit}
                    </button>
                    {/* Prominent delete for admins -- the cascade-delete modal
                        (client + contracts + payments) was previously buried
                        inside the edit form. */}
                    {role === "admin" && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-500 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600 active:scale-[0.98]"
                      >
                        {t.clients.form.delete}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!editing && (
                <div className="grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-3">
                  {profileFields.map((f) => (
                    <div
                      key={f.label}
                      className="flex min-h-[60px] min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 transition-colors hover:border-brand-soft hover:bg-slate-50"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm">
                        {f.icon}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {f.label}
                        </span>
                        {f.href && f.value ? (
                          <a
                            href={f.href}
                            className="truncate text-sm font-semibold text-slate-800 hover:text-[var(--brand)] hover:underline"
                          >
                            {f.value}
                          </a>
                        ) : (
                          <span className="truncate text-sm font-semibold text-slate-800">
                            {f.value || "—"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {client.notes && (
                    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 sm:col-span-2 xl:col-span-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm">
                        {FIELD_ICONS.note}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {t.clients.form.notes}
                        </span>
                        <span className="text-sm text-slate-700">{client.notes}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {editing && (
                <ClientForm
                  initial={{
                    name: client.name,
                    phone: client.phone ?? "",
                    email: client.email ?? "",
                    passport: client.passport ?? "",
                    passport_issued_by: client.passport_issued_by ?? "",
                    birth_date: client.birth_date ?? "",
                    address: client.address ?? "",
                    interested_object_id: client.interested_object_id ?? "",
                    notes: client.notes ?? "",
                  }}
                  submitting={submitting}
                  onSubmit={handleSubmit}
                  onDelete={role === "admin" ? handleDelete : undefined}
                />
              )}
            </div>

            {!readOnly && (
              <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
                <ClientQuickPayment contracts={contracts} onRecorded={loadContracts} />
              </div>
            )}
          </div>

          {/* Purchases: unit, money state, and the two actions staff need
              from here -- print the contract, take a payment. */}
          <div className="animate-fade-up flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" style={{ animationDelay: "250ms" }}>
            <p className="text-sm font-semibold text-slate-700">{t.clients.purchases.title}</p>
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
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">{t.clients.purchases.object}</th>
                      <th className="px-3 py-2.5 font-medium">{t.contracts.form.status}</th>
                      <th className="px-3 py-2.5 font-medium">{t.contracts.form.amount}</th>
                      <th className="px-3 py-2.5 font-medium">{t.contracts.form.paidAmount}</th>
                      <th className="px-3 py-2.5 font-medium">{t.buildings.hover.remaining}</th>
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
                            <span className="block text-xs text-slate-400">
                              {[c.object?.building?.name, c.number ? `№${c.number}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
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
                            {/* One entry point -- the contract page now holds
                                печать / платежи as tabs, so no scattered
                                per-row print button here. */}
                            <Link
                              href={`/contracts/${c.id}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-95"
                            >
                              {t.clients.purchases.open} →
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

          {/* Full receipt history -- every payment ever taken from this
              client, with one-click reprint of any receipt. */}
          <div className="animate-fade-up flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" style={{ animationDelay: "300ms" }}>
            <p className="text-sm font-semibold text-slate-700">
              {t.clients.paymentHistory.title}
            </p>
            {paidPayments.length === 0 ? (
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
                      <th className="px-3 py-2.5 font-medium">{t.clients.paymentHistory.date}</th>
                      <th className="px-3 py-2.5 font-medium">{t.clients.purchases.object}</th>
                      <th className="px-3 py-2.5 font-medium">{t.contracts.payments.amount}</th>
                      <th className="px-5 py-2.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {paidPayments.map((p) => {
                      const c = contracts.find((cc) => cc.id === p.contract_id);
                      return (
                        <tr key={p.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-5 py-3 font-medium text-slate-500">
                            №{receiptNumberFor(paymentsByContract[p.contract_id] ?? [], p.id)}
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            {formatShortDate(p.paid_date ?? p.due_date)}
                          </td>
                          <td className="px-3 py-3">
                            <Link
                              href={`/contracts/${p.contract_id}`}
                              className="text-slate-700 hover:underline"
                            >
                              {c?.object?.name ?? "—"}
                            </Link>
                          </td>
                          <td className="px-3 py-3 font-medium text-emerald-600">
                            {formatCurrency(p.amount, c?.currency ?? "TJS")}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              href={`/contracts/${p.contract_id}/payments/${p.id}/receipt`}
                              className="inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
                            >
                              🖨 {t.contracts.receipt.print}
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
        </>
      )}
      <Toast
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((prev) => ({ ...prev, message: null }))}
      />
      {deleteOpen && client && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setDeleteOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-bold text-red-600">
              {t.clients.cascadeDelete.title}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {t.clients.cascadeDelete.warning}
            </p>
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {client.name} · {activeContracts.length}{" "}
              {t.clients.cascadeDelete.contracts} · {payments.length}{" "}
              {t.clients.cascadeDelete.payments}
            </p>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">
                {t.clients.cascadeDelete.typeToConfirm}
              </span>
              <input
                value={deleteTyped}
                onChange={(e) => setDeleteTyped(e.target.value)}
                placeholder={client.name}
                autoFocus
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </label>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t.clients.cascadeDelete.cancel}
              </button>
              <button
                type="button"
                onClick={confirmCascadeDelete}
                disabled={deleting || deleteTyped.trim() !== client.name.trim()}
                title={
                  deleteTyped && deleteTyped.trim() !== client.name.trim()
                    ? t.clients.cascadeDelete.mismatch
                    : undefined
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-40"
              >
                {deleting ? t.common.loading : t.clients.cascadeDelete.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
