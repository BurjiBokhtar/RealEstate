"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { FileUploadField } from "@/components/FileUploadField";
import { useSettings } from "@/lib/settings/SettingsProvider";
import type { SettingsInput } from "@/lib/settings/types";

const PLACEHOLDERS = [
  "contract_number",
  "signed_date",
  "client_name",
  "client_passport",
  "object_name",
  "object_area",
  "building_address",
  "price_per_sqm",
  "amount",
  "amount_words",
  "currency",
  "company_name",
  "company_director",
  "company_address",
  "company_bank_details",
];

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
    contract_template: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      contract_template: settings.contract_template ?? "",
    });
  }, [settings]);

  const update = <K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    await supabase
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
        contract_template: values.contract_template || null,
      })
      .eq("id", true);
    await refresh();
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>

      {!configured && <SetupNotice />}

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-700">{t.settings.company.title}</p>
        <span className="text-xs text-slate-400">{t.settings.company.hint}</span>
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
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.settings.company.director}</span>
          <input
            value={values.company_director}
            onChange={(e) => update("company_director", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.settings.company.address}</span>
          <input
            value={values.company_address}
            onChange={(e) => update("company_address", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
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
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-700">{t.settings.template.title}</p>
        <span className="text-xs text-slate-400">{t.settings.template.hint}</span>
        <textarea
          value={values.contract_template}
          onChange={(e) => update("contract_template", e.target.value)}
          rows={18}
          className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed"
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">
            {t.settings.template.placeholders}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map((p) => (
              <code
                key={p}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
              >
                {`{{${p}}}`}
              </code>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-700">{t.settings.sms.title}</p>
        <span className="text-xs text-slate-400">{t.settings.sms.hint}</span>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.settings.sms.provider}</span>
          <input
            readOnly
            value="Payom.tj"
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.settings.sms.apiKey}</span>
          <input
            type="password"
            value={values.sms_api_key}
            onChange={(e) => update("sms_api_key", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 font-mono"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.settings.sms.senderName}</span>
          <input
            value={values.sms_sender_name}
            onChange={(e) => update("sms_sender_name", e.target.value)}
            placeholder={t.settings.sms.senderNamePlaceholder}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.settings.sms.reminderDays}</span>
          <input
            type="number"
            min="0"
            value={values.sms_reminder_days}
            onChange={(e) => update("sms_reminder_days", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
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
            className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
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
            className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
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
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {t.settings.save}
        </button>
        {saved && <span className="text-sm text-emerald-600">{t.settings.saved}</span>}
      </div>
    </div>
  );
}
