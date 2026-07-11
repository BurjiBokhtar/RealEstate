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
  const { settings, refresh } = useSettings();
  const { role } = useRole();

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

  useEffect(() => {
    setValues({
      sms_api_key: settings.sms_api_key ?? "",
      sms_sender_name: settings.sms_sender_name ?? "",
      sms_reminder_days: settings.sms_reminder_days.toString(),
      sms_payment_template: settings.sms_payment_template ?? "",
      sms_task_template: settings.sms_task_template ?? "",
      company_name: settings.company_name ?? "",
      company_director: settings.company_director ?? "",
      company_address: settings.company_address ?? "",
      company_bank_details: settings.company_bank_details ?? "",
      company_logo_url: settings.company_logo_url ?? "",
    });
  }, [settings]);

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

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
        {role === "admin" && (
          <Link
            href="/settings/users"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            {t.settings.usersLink}
          </Link>
        )}
      </div>

      {!configured && <SetupNotice />}

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

        <Accordion title={t.settings.template.title}>
          <span className="text-xs text-slate-400">{t.settings.template.locked}</span>
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
