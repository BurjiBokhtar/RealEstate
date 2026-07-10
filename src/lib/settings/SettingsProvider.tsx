"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import type { Settings } from "./types";

const DEFAULT_SETTINGS: Settings = {
  id: true,
  usd_rate: 10.5,
  sms_api_key: null,
  sms_sender_name: "BurjiBohtar",
  sms_reminder_days: 3,
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
