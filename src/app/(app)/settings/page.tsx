"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { FileUploadField } from "@/components/FileUploadField";
import { Accordion } from "@/components/Accordion";
import { Toast, type ToastType } from "@/components/Toast";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { useRole } from "@/lib/auth/useRole";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";
import type { SettingsInput } from "@/lib/settings/types";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const PAYMENT_SMS_PLACEHOLDERS = [
  "client_name",
  "amount",
  "currency",
  "contract_number",
  "due_date",
];

const TASK_SMS_PLACEHOLDERS = ["assignee", "title", "due_date"];

export default function SettingsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();
  const { refresh } = useSettings();
  const { role, loading: roleLoading } = useRole();

  const [values, setValues] = useState<SettingsInput>({
    sms_api_key: "",
    sms_sender_name: "",
    sms_reminder_days: "",
    sms_payment_template: "",
    sms_task_template: "",
    company_name: "",
    company_director: "",
    company_address: "",
    company_bank_details: "",
    company_logo_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Loaded separately from the app-wide SettingsProvider, which deliberately
  // never fetches sms_api_key (it's mounted for every signed-in user
  // regardless of role) -- this page is the one place that needs the full
  // row, and it's only reachable by admins in the first place.
  useEffect(() => {
    if (role !== "admin" || !configured) return;
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("settings")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setValues({
          sms_api_key: data.sms_api_key ?? "",
          sms_sender_name: data.sms_sender_name ?? "",
          sms_reminder_days: data.sms_reminder_days.toString(),
          sms_payment_template: data.sms_payment_template ?? "",
          sms_task_template: data.sms_task_template ?? "",
          company_name: data.company_name ?? "",
          company_director: data.company_director ?? "",
          company_address: data.company_address ?? "",
          company_bank_details: data.company_bank_details ?? "",
          company_logo_url: data.company_logo_url ?? "",
        });
      });
  }, [role, configured]);

  const update = <K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error, data } = await supabase
      .schema("crm")
      .from("settings")
      .update({
        sms_api_key: values.sms_api_key || null,
        sms_sender_name: values.sms_sender_name || null,
        sms_reminder_days: values.sms_reminder_days ? Number(values.sms_reminder_days) : 3,
        sms_payment_template: values.sms_payment_template || null,
        sms_task_template: values.sms_task_template || null,
        company_name: values.company_name || null,
        company_director: values.company_director || null,
        company_address: values.company_address || null,
        company_bank_details: values.company_bank_details || null,
        company_logo_url: values.company_logo_url || null,
      })
      .eq("id", true)
      .select("id");
    setSaving(false);
    if (error) {
      setToast({ message: error.message, type: "error" });
      return;
    }
    if (!data || data.length === 0) {
      setToast({ message: t.settings.saveBlocked, type: "error" });
      return;
    }
    await refresh();
    setToast({ message: t.settings.saved, type: "success" });
  };

  if (roleLoading) return <p className="text-slate-400">{t.common.loading}</p>;
  if (role !== "admin") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
        <p className="text-slate-500">{t.users.accessDenied}</p>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>

      {role === "admin" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/settings/users"
            className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5b3468]/10 text-[#5b3468]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5"/><circle cx="17.5" cy="9.5" r="2.5"/><path d="M16 15.2c2.6.3 4.6 1.8 5.5 4.3"/></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-800">{t.settings.usersLink}</span>
              <span className="block text-xs text-slate-400">{t.settings.usersHint}</span>
            </span>
            <span className="text-slate-300 transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <Link
            href="/settings/audit-log"
            className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M4 5h16M4 12h16M4 19h10"/><circle cx="19" cy="19" r="2"/></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-800">{t.settings.auditLogLink}</span>
              <span className="block text-xs text-slate-400">{t.settings.auditHint}</span>
            </span>
            <span className="text-slate-300 transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      )}

      {!configured && <SetupNotice />}

      {configured && <ChangePasswordCard />}

      <div className="flex flex-col gap-3">
        <Accordion title={t.settings.company.title} defaultOpen>
          <span className="-mt-2 text-xs text-slate-400">{t.settings.company.hint}</span>
          <FileUploadField
            label={t.settings.company.logo}
            value={values.company_logo_url}
            onChange={(url) => update("company_logo_url", url)}
            folder="company-logo"
            uploadLabel={t.objects.form.upload}
            uploadingLabel={t.objects.form.uploading}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.settings.company.name}</span>
            <input
              value={values.company_name}
              onChange={(e) => update("company_name", e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.settings.company.director}</span>
            <input
              value={values.company_director}
              onChange={(e) => update("company_director", e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.settings.company.address}</span>
            <input
              value={values.company_address}
              onChange={(e) => update("company_address", e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">
              {t.settings.company.bankDetails}
            </span>
            <textarea
              value={values.company_bank_details}
              onChange={(e) => update("company_bank_details", e.target.value)}
              placeholder={t.settings.company.bankDetailsPlaceholder}
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
        </Accordion>

        <Accordion title={t.settings.sms.title}>
          <span className="-mt-2 text-xs text-slate-400">{t.settings.sms.hint}</span>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.settings.sms.provider}</span>
            <input
              readOnly
              value="Payom.tj"
              className={`${FIELD_CLASS} border-slate-200 bg-slate-50 text-slate-500`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.settings.sms.apiKey}</span>
            <input
              type="password"
              value={values.sms_api_key}
              onChange={(e) => update("sms_api_key", e.target.value)}
              className={`${FIELD_CLASS} font-mono`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.settings.sms.senderName}</span>
            <input
              value={values.sms_sender_name}
              onChange={(e) => update("sms_sender_name", e.target.value)}
              placeholder={t.settings.sms.senderNamePlaceholder}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.settings.sms.reminderDays}</span>
            <input
              type="number"
              min="0"
              value={values.sms_reminder_days}
              onChange={(e) => update("sms_reminder_days", e.target.value)}
              className={FIELD_CLASS}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">
              {t.settings.sms.paymentTemplate}
            </span>
            <textarea
              value={values.sms_payment_template}
              onChange={(e) => update("sms_payment_template", e.target.value)}
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_SMS_PLACEHOLDERS.map((p) => (
                <code
                  key={p}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                >
                  {`{{${p}}}`}
                </code>
              ))}
            </div>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.settings.sms.taskTemplate}</span>
            <textarea
              value={values.sms_task_template}
              onChange={(e) => update("sms_task_template", e.target.value)}
              rows={2}
              className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            <div className="flex flex-wrap gap-1.5">
              {TASK_SMS_PLACEHOLDERS.map((p) => (
                <code
                  key={p}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                >
                  {`{{${p}}}`}
                </code>
              ))}
            </div>
          </label>
        </Accordion>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-fit rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
      >
        {saving ? t.common.loading : t.settings.save}
      </button>

      <Toast
        message={toast?.message ?? null}
        type={toast?.type ?? "success"}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
