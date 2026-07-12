"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import type { Settings } from "./types";

const DEFAULT_SETTINGS: Settings = {
  id: true,
  sms_api_key: null,
  sms_sender_name: null,
  sms_reminder_days: 3,
  sms_payment_template: null,
  sms_task_template: null,
  company_name: null,
  company_director: null,
  company_address: null,
  company_bank_details: null,
  company_logo_url: null,
  updated_at: new Date(0).toISOString(),
};

type SettingsContextValue = {
  settings: Settings;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    // This provider is mounted for every signed-in user regardless of role
    // (it's what puts the company name/logo in the sidebar and the bank
    // details on a printed contract), so it deliberately never selects
    // sms_api_key -- that credential has no reason to sit in every
    // manager's browser state just from loading the app. The settings page
    // itself fetches the full row separately, gated to admins only.
    const { data } = await supabase
      .schema("crm")
      .from("settings")
      .select(
        "id, sms_sender_name, sms_reminder_days, sms_payment_template, sms_task_template, company_name, company_director, company_address, company_bank_details, company_logo_url, updated_at"
      )
      .maybeSingle();
    if (data) setSettings({ ...DEFAULT_SETTINGS, ...data } as Settings);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
