"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Client } from "@/lib/clients/types";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-3 text-sm text-[var(--ink-1)] transition-colors focus:border-[var(--field-focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--field-focus-ring)]";

type Counts = { contracts: number; tasks: number };

// A manager typed the same person in twice -- almost always a name off by
// one letter, exactly the case that prompted this. This is always run
// FROM the client being kept: search finds the duplicate, everything it
// owns (contracts, tasks) moves onto the client whose page this modal was
// opened from, blank fields on the survivor get filled in from the
// duplicate, and the duplicate is deleted. See crm.merge_clients for why
// this can't just be "change client_id and delete" from the UI directly
// -- contracts.client_id is ON DELETE RESTRICT.
export function MergeClientModal({
  keepClient,
  onClose,
  onMerged,
}: {
  keepClient: Client;
  onClose: () => void;
  onMerged: (mergedName: string) => void;
}) {
  const { t } = useLocale();
  const confirm = useConfirm();

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [results, setResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Client | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q || picked) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    createClient()
      .schema("crm")
      .from("clients")
      .select("*")
      .neq("id", keepClient.id)
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%,phone2.ilike.%${q}%`)
      .order("name")
      .limit(8)
      .then(({ data }) => {
        if (cancelled) return;
        setResults((data ?? []) as Client[]);
        setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, keepClient.id, picked]);

  const pick = async (client: Client) => {
    setPicked(client);
    setResults([]);
    setError(null);
    const supabase = createClient();
    const [contractsRes, tasksRes] = await Promise.all([
      supabase
        .schema("crm")
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id),
      supabase
        .schema("crm")
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id),
    ]);
    setCounts({ contracts: contractsRes.count ?? 0, tasks: tasksRes.count ?? 0 });
  };

  const reset = () => {
    setPicked(null);
    setCounts(null);
    setError(null);
    setQuery("");
  };

  const handleMerge = async () => {
    if (!picked) return;
    const ok = await confirm(
      t.clients.merge.confirm
        .replace("{duplicate}", picked.name)
        .replace("{keep}", keepClient.name),
      { danger: true, confirmLabel: t.clients.merge.confirmButton }
    );
    if (!ok) return;
    setMerging(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase
      .schema("crm")
      .rpc("merge_clients", { p_keep_id: keepClient.id, p_remove_id: picked.id });
    setMerging(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onMerged(picked.name);
  };

  return (
    <Modal title={t.clients.merge.title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--ink-3)]">{t.clients.merge.hint}</p>

        {!picked ? (
          <div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-[var(--ink-2)]">{t.clients.merge.searchLabel}</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.clients.search}
                className={FIELD_CLASS}
                autoFocus
              />
            </label>
            {searching && (
              <p className="mt-2 text-xs text-[var(--ink-5)]">{t.common.loading}</p>
            )}
            {!searching && query.trim() && results.length === 0 && (
              <p className="mt-2 text-xs text-[var(--ink-5)]">{t.clients.merge.noResults}</p>
            )}
            {results.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick(c)}
                    className="flex flex-col items-start rounded-lg border border-[var(--border-c)] px-3 py-2 text-left transition-colors hover:border-brand-soft hover:bg-[var(--hover-c)]"
                  >
                    <span className="text-sm font-medium text-[var(--ink-1)]">{c.name}</span>
                    {c.phone && <span className="text-xs text-[var(--ink-5)]">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[var(--wash-emerald-border)] bg-[var(--wash-emerald)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--wash-emerald-ink)]">
                  {t.clients.merge.keepLabel}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--ink-1)]">{keepClient.name}</p>
                {keepClient.phone && (
                  <p className="text-xs text-[var(--ink-3)]">{keepClient.phone}</p>
                )}
              </div>
              <div className="rounded-lg border border-[var(--wash-rose-border)] bg-[var(--wash-rose)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--wash-rose-ink)]">
                  {t.clients.merge.removeLabel}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--ink-1)]">{picked.name}</p>
                {picked.phone && <p className="text-xs text-[var(--ink-3)]">{picked.phone}</p>}
              </div>
            </div>

            <p className="text-sm text-[var(--ink-3)]">
              {counts
                ? t.clients.merge.willMove
                    .replace("{contracts}", String(counts.contracts))
                    .replace("{tasks}", String(counts.tasks))
                : t.common.loading}
            </p>
            <p className="text-xs text-[var(--wash-amber-ink)]">{t.clients.merge.irreversible}</p>

            {error && <p className="text-sm text-[var(--wash-rose-ink)]">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={reset}
                className="h-9 rounded-lg border border-[var(--border-strong-c)] px-3.5 text-sm font-medium text-[var(--ink-2)] transition-all hover:bg-[var(--hover-c)] active:scale-[0.98]"
              >
                {t.clients.merge.pickAnother}
              </button>
              <button
                type="button"
                onClick={handleMerge}
                disabled={merging || !counts}
                className="h-9 rounded-lg bg-[var(--wash-rose-ink)] px-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                {merging ? t.clients.merge.merging : t.clients.merge.confirmButton}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
