"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// One contract, one place: a shared tab bar shown at the top of the contract
// overview / payments / print pages so they read as three tabs of the same
// record instead of three scattered screens.
export function ContractTabs({
  id,
  active,
}: {
  id: string;
  active: "overview" | "payments" | "print";
}) {
  const { t } = useLocale();
  const tabs = [
    { key: "overview", href: `/contracts/${id}`, label: t.contracts.tabs.overview },
    { key: "payments", href: `/contracts/${id}/payments`, label: t.contracts.tabs.payments },
    { key: "print", href: `/contracts/${id}/print`, label: t.contracts.tabs.print },
  ] as const;

  return (
    <div className="flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((tb) => (
        <Link
          key={tb.key}
          href={tb.href}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
            active === tb.key
              ? "bg-[#1c1a3a] text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          {tb.label}
        </Link>
      ))}
    </div>
  );
}
