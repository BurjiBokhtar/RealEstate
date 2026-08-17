"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import type { Settings } from "./types";

const DEFAULT_SETTINGS: Settings = {
  id: true,
  // Not fetched by this provider (see below) -- only the Settings page reads
  // the real value, so the app-wide default is enough here.
  sms_provider: "Payom.tj",
  sms_api_key: null,
  sms_sender_name: null,
  sms_reminder_days: 3,
  sms_payment_template: null,
  sms_task_template: null,
  sms_enabled: false,
  sms_last_run_at: null,
  sms_last_result: null,
  company_name: null,
  company_director: null,
  company_address: null,
  company_bank_details: null,
  company_logo_url: null,
  hero_theme: null,
  hero_pattern: null,
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
    const { data, error } = await supabase
      .schema("crm")
      .from("settings")
      .select(
        "id, sms_sender_name, sms_reminder_days, sms_payment_template, sms_task_template, company_name, company_director, company_address, company_bank_details, company_logo_url, hero_theme, hero_pattern, updated_at"
      )
      .maybeSingle();
    if (data) {
      setSettings({ ...DEFAULT_SETTINGS, ...data } as Settings);
    } else if (error) {
      // A failed fetch here used to fall back to blank defaults silently,
      // which read as "the company data I saved just isn't shown anywhere"
      // (no logo in the sidebar, dashes on printed contracts). If the
      // explicit column list is what failed (e.g. this database is missing
      // a column from a not-yet-applied migration), retry with * and strip
      // the credential client-side -- degraded but correct branding beats
      // silently blank documents.
      console.error("settings fetch failed:", error.message);
      const fallback = await supabase.schema("crm").from("settings").select("*").maybeSingle();
      if (fallback.data) {
        const row = { ...fallback.data };
        delete (row as Record<string, unknown>).sms_api_key;
        setSettings({ ...DEFAULT_SETTINGS, ...row } as Settings);
      } else if (fallback.error) {
        console.error("settings fallback fetch failed:", fallback.error.message);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // The first fetch can race session hydration right after login (an
    // unauthenticated request gets nothing back under RLS and the provider
    // would sit on blank defaults until a full reload) -- refetch whenever
    // auth lands in a signed-in state.
    const supabase = isSupabaseConfigured() ? createClient() : null;
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  // Memoised for the same reason as LocaleProvider: it wraps the whole app.
  const value = useMemo(
    () => ({ settings, loading, refresh }),
    [settings, loading, refresh]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
