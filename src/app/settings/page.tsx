"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { useSettings } from "@/lib/settings/SettingsProvider";
import type { SettingsInput } from "@/lib/settings/types";

export default function SettingsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();
  const { settings, refresh } = useSettings();

  const [values, setValues] = useState<SettingsInput>({
    usd_rate: "",
    sms_api_key: "",
    sms_sender_name: "",
    sms_reminder_days: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValues({
      usd_rate: settings.usd_rate.toString(),
      sms_api_key: settings.sms_api_key ?? "",
      sms_sender_name: settings.sms_sender_name ?? "",
      sms_reminder_days: settings.sms_reminder_days.toString(),
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
        usd_rate: values.usd_rate ? Number(values.usd_rate) : 0,
        sms_api_key: values.sms_api_key || null,
        sms_sender_name: values.sms_sender_name || null,
        sms_reminder_days: values.sms_reminder_days ? Number(values.sms_reminder_days) : 3,
      })
      .eq("id", true);
    await refresh();
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>

      {!configured && <SetupNotice />}

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-700">{t.settings.currency.title}</p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.settings.currency.usdRate}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.usd_rate}
            onChange={(e) => update("usd_rate", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <span className="text-xs text-slate-400">{t.settings.currency.hint}</span>
        </label>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-700">{t.settings.sms.title}</p>
        <span className="text-xs text-slate-400">{t.settings.sms.hint}</span>
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
          <span className="font-medium text-slate-700">{t.settings.sms.endpoint}</span>
          <input
            readOnly
            value="https://gateway.payom.tj/api/message"
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-400"
          />
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
