"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BackLink } from "@/components/BackLink";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ClientForm } from "@/components/ClientForm";
import { ClientIdentity } from "@/components/ClientIdentity";
import { StatTileRow } from "@/components/StatTile";
import { SendActions } from "@/components/SendActions";
import { ActionBar, IconAction } from "@/components/ActionBar";
import { ContractPayments } from "@/components/ContractPayments";
import { ContractForm } from "@/components/ContractForm";
import { UnitPriceModal } from "@/components/UnitPriceModal";
import { useConfirm } from "@/components/ConfirmDialog";
import { HomeIcon, PencilIcon, TagIcon } from "@/components/icons";
import { Toast, type ToastType } from "@/components/Toast";
import { formatCurrency } from "@/lib/currency";
import { MoneyPairValue, type MoneyPair } from "@/components/MoneyPairValue";
import { CONTRACT_STATUS_COLORS } from "@/lib/contracts/format";
import { useRole } from "@/lib/auth/useRole";
import type { Client, ClientInput } from "@/lib/clients/types";
import type { Contract, ContractInput, ContractPayment } from "@/lib/contracts/types";

// The full Contract shape (not just the summary columns the old table
// showed) -- ContractPayments needs payment_type/installment_months/etc to
// generate and render the schedule, since each purchase card now embeds
// that component directly instead of linking out to its own page.
type ClientContract = Contract & {
  // The unit's own id/area/price come along so the apartment's price can be
  // corrected from here (see UnitPriceModal) -- a sold cell in the shakhmatka
  // opens the buyer, not the unit editor, so this card is the only way in.
  object: {
    id: string;
    name: string;
    area: number | null;
    price: number | null;
    building: { name: string } | null;
  } | null;
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
// are (compact card, edit tucked away behind a button), and every apartment
// they've bought as an expandable card -- opening one reveals the exact
// cash-desk this client used to have to navigate away to (record a
// payment, see the schedule, print/share) right in place. That old
// standalone page (/contracts/[id]/payments) now just redirects here with
// ?contract=<id> so it opens pre-expanded and scrolled into view.
export default function ClientDetailPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();
  const { role } = useRole();
  const confirm = useConfirm();

  // Seeded from `configured` rather than set from inside the effect: the
  // flag is a build-time env check, constant for the whole session, so the
  // not-configured case is a starting value, not something to synchronise.
  const [client, setClient] = useState<Client | null | undefined>(
    configured ? undefined : null
  );
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Where the back button goes; defaults to the client list.
  const [backTo, setBackTo] = useState<string | null>(null);
  // Which contract's edit form is open, and which apartment's price dialog --
  // both used to live on the separate /contracts/[id] screen.
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [pricingContract, setPricingContract] = useState<ClientContract | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Read ?contract=<id> once on mount (plain URLSearchParams, not the
  // Next.js hook -- avoids a Suspense boundary just for a one-off read) so
  // a redirect from the old cash-desk URL lands pre-expanded.
  //
  // ?from=<path> is where the visitor actually came from. Opening a sold flat
  // in the shakhmatka lands here, and "back to the client list" sent people to
  // a page they had never been on -- the way out has to point at the
  // shakhmatka instead.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("contract");
    if (id) setExpandedId(id);
    const from = q.get("from");
    // Only same-origin relative paths: never let a query parameter turn the
    // back button into a link to somebody else's site.
    if (from && from.startsWith("/") && !from.startsWith("//")) setBackTo(from);
  }, []);

  useEffect(() => {
    if (!expandedId) return;
    cardRefs.current[expandedId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [expandedId, contracts]);

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
        "id, number, client_id, object_id, amount, paid_amount, currency, amount_words, status, signed_date, notes, payment_type, installment_months, barter_details, created_at, updated_at, object:objects(id, name, area, price, building:buildings(name))"
      )
      .eq("client_id", params.id)
      .order("signed_date", { ascending: false });
    const rows = (data ?? []) as unknown as ClientContract[];
    setContracts(rows);
    // One apartment means there is nothing to choose between -- open it, so
    // the payment history and the cash desk are on screen straight away
    // instead of one click down.
    if (rows.length === 1) setExpandedId((prev) => prev ?? rows[0].id);
  }, [params.id]);

  // Filtered THROUGH the contract rather than by a list of contract ids, so
  // this no longer has to wait for loadContracts() to come back first -- the
  // client card used to spend two full round trips in a row before it could
  // show a single payment.
  const loadPayments = useCallback(async () => {
    const { data } = await createClient()
      .schema("crm")
      .from("contract_payments")
      .select("*, contract:contracts!inner(client_id)")
      .eq("contract.client_id", params.id);
    const rows = (data ?? []) as unknown as ContractPayment[];
    rows.sort((a, b) => (b.paid_date ?? b.due_date).localeCompare(a.paid_date ?? a.due_date));
    setPayments(rows);
  }, [params.id]);

  // Recording a payment changes both the contract's paid_amount and the
  // installment rows, so the two reload together.
  const reloadAfterPayment = useCallback(async () => {
    await Promise.all([loadContracts(), loadPayments()]);
  }, [loadContracts, loadPayments]);

  // ---- Contract editing, moved here from the standalone /contracts/[id] page.
  const handleContractSubmit = async (values: ContractInput) => {
    if (!editingContractId) return;
    setSubmitting(true);
    const { error } = await createClient()
      .schema("crm")
      .from("contracts")
      .update({
        number: values.number || null,
        client_id: values.client_id,
        object_id: values.object_id,
        amount: Number(values.amount) || 0,
        // paid_amount is deliberately NOT written here. It is the sum of the
        // contract's receipts, maintained by a trigger (migration 042).
        // Saving the form used to overwrite it with whatever stood in the
        // "Оплачено" box, which is how the balance stopped matching the
        // payment history.
        currency: values.currency,
        amount_words: values.amount_words || null,
        status: values.status,
        signed_date: values.signed_date || null,
        notes: values.notes || null,
        payment_type: values.payment_type,
        installment_months: values.installment_months ? Number(values.installment_months) : null,
        barter_details: values.barter_details || null,
      })
      .eq("id", editingContractId);
    setSubmitting(false);
    if (error) {
      setToast({ message: error.message, type: "error" });
      return;
    }
    setEditingContractId(null);
    setToast({ message: t.buildings.unitEdit.saved, type: "success" });
    await reloadAfterPayment();
  };

  const handleContractDelete = async (contractId: string) => {
    if (!(await confirm(t.contracts.form.confirmDelete, { danger: true }))) return;
    const { error } = await createClient()
      .schema("crm")
      .from("contracts")
      .delete()
      .eq("id", contractId);
    if (error) {
      setToast({ message: error.message, type: "error" });
      return;
    }
    setEditingContractId(null);
    await reloadAfterPayment();
  };

  useEffect(() => {
    if (!configured) return;
    loadClient();
    loadContracts();
    loadPayments();
  }, [configured, loadClient, loadContracts, loadPayments]);

  const handleSubmit = async (values: ClientInput) => {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase
      .schema("crm")
      .from("clients")
      .update({
        name: values.name,
        phone: values.phone || null,
        phone2: values.phone2 || null,
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
          label: t.clients.form.phone2,
          value: client.phone2,
          href: client.phone2 ? `tel:${client.phone2.replace(/\s/g, "")}` : undefined,
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
      <BackLink href={backTo ?? "/clients"}>
        {backTo?.startsWith("/buildings") ? t.clients.backToShakhmatka : t.clients.backToList}
      </BackLink>

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
          <StatTileRow tiles={statTiles} />

          {/* Profile card: everything at a glance, edit folded away */}
          <div
            className="animate-fade-up flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            style={{ animationDelay: "150ms" }}
          >
            <ClientIdentity
              name={client.name}
              phone={client.phone}
              source={client.source}
              size="lg"
              actions={
                !readOnly && (
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
                )
              }
            />

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
                  phone2: client.phone2 ?? "",
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

          {/* Purchases: every apartment this client bought, each an
              expandable card. Opening one reveals the same cash desk
              (record a payment, schedule, print/share) the old standalone
              contract-payments page showed -- no second page needed. */}
          <div className="animate-fade-up flex flex-col gap-3" style={{ animationDelay: "250ms" }}>
            <p className="text-sm font-semibold text-slate-700">{t.clients.purchases.title}</p>
            {contracts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <HomeIcon className="h-5 w-5" />
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
              <div className="flex flex-col gap-2.5">
                {contracts.map((c) => {
                  const remaining = c.amount - c.paid_amount;
                  const paidCount = (paymentsByContract[c.id] ?? []).filter((p) => p.paid).length;
                  const isOpen = expandedId === c.id;
                  return (
                    <div
                      key={c.id}
                      ref={(el) => {
                        cardRefs.current[c.id] = el;
                      }}
                      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-colors ${
                        isOpen ? "border-brand-soft" : "border-slate-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : c.id)}
                        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {c.object?.name ?? "—"}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {[c.object?.building?.name, c.number ? `№${c.number}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                            {paidCount > 0 &&
                              ` · ${paidCount} ${t.clients.purchases.paymentsCount.toLowerCase()}`}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${CONTRACT_STATUS_COLORS[c.status]}`}
                        >
                          {t.contracts.statuses[c.status]}
                        </span>
                        <div className="hidden shrink-0 items-baseline gap-4 text-right sm:flex">
                          <div>
                            <p className="text-[9.5px] uppercase tracking-wide text-slate-400">
                              {t.contracts.form.amount}
                            </p>
                            <p className="text-sm font-semibold text-slate-700">
                              {formatCurrency(c.amount, c.currency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9.5px] uppercase tracking-wide text-slate-400">
                              {t.contracts.form.paidAmount}
                            </p>
                            <p className="text-sm font-semibold text-emerald-600">
                              {formatCurrency(c.paid_amount, c.currency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9.5px] uppercase tracking-wide text-slate-400">
                              {t.buildings.hover.remaining}
                            </p>
                            <p
                              className={`text-sm font-semibold ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}
                            >
                              {remaining > 0 ? formatCurrency(remaining, c.currency) : "—"}
                            </p>
                          </div>
                        </div>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>

                      {isOpen && (
                        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 p-4">
                          {/* Every action for this deal in ONE icon toolbar on
                              the right -- share, print, re-price the flat,
                              edit the contract. They used to be two icons at
                              the far left and two wide text buttons at the far
                              right of the same row. */}
                          <ActionBar>
                            <SendActions
                              contractId={c.id}
                              kind="contract"
                              printAction={{
                                href: `/contracts/${c.id}/print`,
                                label: t.contracts.print.button,
                              }}
                              extraActions={
                                <>
                                  {role === "admin" && c.object && (
                                    <IconAction
                                      label={t.buildings.unitPrice.edit}
                                      icon={<TagIcon className="h-4 w-4" />}
                                      onClick={() => setPricingContract(c)}
                                    />
                                  )}
                                  {role !== "director" && (
                                    <IconAction
                                      label={
                                        editingContractId === c.id
                                          ? t.clients.profile.hideForm
                                          : t.contracts.cashier.editFull
                                      }
                                      icon={<PencilIcon className="h-4 w-4" />}
                                      active={editingContractId === c.id}
                                      onClick={() =>
                                        setEditingContractId(
                                          editingContractId === c.id ? null : c.id
                                        )
                                      }
                                    />
                                  )}
                                </>
                              }
                            />
                          </ActionBar>

                          {/* Contract particulars -- these used to be the whole
                              point of the separate /contracts/[id] screen. */}
                          {editingContractId !== c.id && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:grid-cols-4">
                              {[
                                { label: t.contracts.form.number, value: c.number || "—" },
                                {
                                  label: t.contracts.form.paymentType,
                                  value:
                                    t.contracts.paymentTypes[c.payment_type] +
                                    (c.payment_type === "installment" && c.installment_months
                                      ? ` · ${c.installment_months} ${t.contracts.form.monthsShort}`
                                      : ""),
                                },
                                { label: t.contracts.form.signedDate, value: c.signed_date ?? "—" },
                                {
                                  label: t.buildings.unitPrice.title,
                                  value:
                                    c.object?.price != null
                                      ? formatCurrency(c.object.price, c.currency)
                                      : "—",
                                },
                              ].map((f) => (
                                <div key={f.label} className="flex flex-col gap-0.5">
                                  <span className="text-[11px] uppercase tracking-wide text-slate-400">
                                    {f.label}
                                  </span>
                                  <span className="text-sm text-slate-800">{f.value}</span>
                                </div>
                              ))}
                              {c.notes && (
                                <div className="col-span-2 flex flex-col gap-0.5 sm:col-span-4">
                                  <span className="text-[11px] uppercase tracking-wide text-slate-400">
                                    {t.contracts.form.notes}
                                  </span>
                                  <span className="text-sm text-slate-800">{c.notes}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {editingContractId === c.id && (
                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                              <ContractForm
                                initial={{
                                  number: c.number ?? "",
                                  client_id: c.client_id,
                                  object_id: c.object_id,
                                  amount: c.amount.toString(),
                                  paid_amount: c.paid_amount.toString(),
                                  currency: c.currency,
                                  amount_words: c.amount_words ?? "",
                                  status: c.status,
                                  signed_date: c.signed_date ?? "",
                                  notes: c.notes ?? "",
                                  payment_type: c.payment_type,
                                  installment_months: c.installment_months?.toString() ?? "",
                                  barter_details: c.barter_details ?? "",
                                }}
                                objectArea={c.object?.area ?? null}
                                // The apartment is already decided -- this is
                                // THIS contract on THIS unit. Locking it also
                                // skips fetching the whole objects table just
                                // to build a dropdown with one right answer.
                                lockedObject={
                                  c.object
                                    ? {
                                        id: c.object.id,
                                        label: c.object.name,
                                        secondaryLabel: null,
                                        buildingName: c.object.building?.name ?? null,
                                        apartmentNumber: null,
                                      }
                                    : undefined
                                }
                                submitting={submitting}
                                onSubmit={handleContractSubmit}
                                onDelete={
                                  role === "admin" ? () => handleContractDelete(c.id) : undefined
                                }
                              />
                            </div>
                          )}

                          <ContractPayments contract={c} onPaymentAdded={reloadAfterPayment} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      {pricingContract?.object && (
        <UnitPriceModal
          unitId={pricingContract.object.id}
          unitName={pricingContract.object.name}
          area={pricingContract.object.area}
          price={pricingContract.object.price}
          currency={pricingContract.currency}
          contractId={pricingContract.id}
          contractAmount={pricingContract.amount}
          onClose={() => setPricingContract(null)}
          onSaved={() => {
            setToast({ message: t.buildings.unitEdit.saved, type: "success" });
            void reloadAfterPayment();
          }}
        />
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
