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
  contract_template: null,
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
    const { data } = await supabase.schema("crm").from("settings").select("*").maybeSingle();
    if (data) setSettings(data as Settings);
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
