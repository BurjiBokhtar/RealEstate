"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ShakhmatkaGrid, type UnitContractInfo } from "@/components/ShakhmatkaGrid";
import { Modal } from "@/components/Modal";
import { ContractBookingModal } from "@/components/ContractBookingModal";
import { Toast, type ToastType } from "@/components/Toast";
import type { Building } from "@/lib/buildings/types";
import type { PropertyObject } from "@/lib/objects/types";
import { useRole } from "@/lib/auth/useRole";
import { formatCurrency } from "@/lib/currency";
import { formatArea } from "@/lib/objects/format";

export default function BuildingDetailPage() {
  const { t } = useLocale();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();

  const [building, setBuilding] = useState<Building | null | undefined>(undefined);
  const [units, setUnits] = useState<PropertyObject[]>([]);
  const [contractsByUnit, setContractsByUnit] = useState<Record<string, UnitContractInfo>>(
    {}
  );
  const [bookingUnit, setBookingUnit] = useState<PropertyObject | null>(null);
  const [viewingUnit, setViewingUnit] = useState<PropertyObject | null>(null);
  const [pendingQuickBook, setPendingQuickBook] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string | null; type: ToastType }>({
    message: null,
    type: "success",
  });
  const { role } = useRole();

  const loadUnits = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .schema("crm")
      .from("objects")
      .select("*")
      .eq("building_id", params.id);
    const unitRows = (data ?? []) as PropertyObject[];
    setUnits(unitRows);

    if (unitRows.length > 0) {
      const { data: contracts } = await supabase
        .schema("crm")
        .from("contracts")
        .select("id, object_id, amount, paid_amount, currency, client:clients(name, source)")
        .in(
          "object_id",
          unitRows.map((u) => u.id)
        );
      const contractRows = (contracts ?? []) as unknown as Array<{
        id: string;
        object_id: string;
        amount: number;
        paid_amount: number;
        currency: UnitContractInfo["currency"];
        client: { name: string; source: string | null } | null;
      }>;

      const paymentsCountByContract: Record<string, number> = {};
      if (contractRows.length > 0) {
        const { data: paymentRows } = await supabase
          .schema("crm")
          .from("contract_payments")
          .select("contract_id")
          .eq("paid", true)
          .in(
            "contract_id",
            contractRows.map((c) => c.id)
          );
        for (const p of (paymentRows ?? []) as Array<{ contract_id: string }>) {
          paymentsCountByContract[p.contract_id] =
            (paymentsCountByContract[p.contract_id] ?? 0) + 1;
        }
      }

      const map: Record<string, UnitContractInfo> = {};
      for (const c of contractRows) {
        map[c.object_id] = {
          id: c.id,
          clientName: c.client?.name ?? "—",
          remaining: c.amount - c.paid_amount,
          currency: c.currency,
          paymentsCount: paymentsCountByContract[c.id] ?? 0,
          isQuickBooking: c.client?.source === "quick_booking" && c.paid_amount === 0,
        };
      }
      setContractsByUnit(map);
    }
  }, [params.id]);

  useEffect(() => {
    if (!configured) {
      setBuilding(null);
      return;
    }
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("buildings")
      .select("*")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data }) => setBuilding((data as Building) ?? null));
    loadUnits();
  }, [configured, params.id, loadUnits]);

  const handleMergeUnits = async (unitA: PropertyObject, unitB: PropertyObject) => {
    const combinedArea = (unitA.area ?? 0) + (unitB.area ?? 0) || null;
    const combinedPrice =
      combinedArea && building?.price_per_sqm
        ? combinedArea * building.price_per_sqm
        : (unitA.price ?? 0) + (unitB.price ?? 0) || null;
    const supabase = createClient();
    await supabase
      .schema("crm")
      .from("objects")
      .update({
        name: unitA.block
          ? `${unitA.block} №${unitA.floor}-${unitA.position_in_floor}-${unitB.position_in_floor}`
          : `№${unitA.floor}-${unitA.position_in_floor}-${unitB.position_in_floor}`,
        area: combinedArea,
        price: combinedPrice,
        span: (unitA.span || 1) + (unitB.span || 1),
      })
      .eq("id", unitA.id);
    await supabase.schema("crm").from("objects").delete().eq("id", unitB.id);
    await loadUnits();
  };

  // Right-click quick booking: reserve the unit instantly with no dialog.
  // A contract still needs a client (DB constraint), so we reuse one shared
  // placeholder "no client yet" record rather than asking staff anything --
  // whoever finishes the paperwork can swap in the real buyer later by
  // opening the contract (left click on the now-reserved cell).
  const getOrCreateQuickBookingClient = async (
    supabase: ReturnType<typeof createClient>
  ): Promise<string> => {
    const { data: existing } = await supabase
      .schema("crm")
      .from("clients")
      .select("id")
      .eq("source", "quick_booking")
      .limit(1)
      .maybeSingle();
    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .schema("crm")
      .from("clients")
      .insert({
        name: "Без клиента (быстрая бронь)",
        source: "quick_booking",
        status: "new",
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? t.common.error);
    return created.id;
  };

  const handleQuickBook = async (unit: PropertyObject) => {
    // Belt and suspenders against duplicate bookings: ignore a second
    // right-click on the same cell while the first is still in flight, and
    // re-check the freshest known status right before writing (in case the
    // click queued up before an earlier state update landed).
    if (pendingQuickBook.has(unit.id)) return;
    const freshUnit = units.find((u) => u.id === unit.id) ?? unit;
    if (freshUnit.status !== "available") return;

    setPendingQuickBook((prev) => new Set(prev).add(unit.id));
    const supabase = createClient();
    try {
      const clientId = await getOrCreateQuickBookingClient(supabase);
      const { data, error } = await supabase
        .schema("crm")
        .from("contracts")
        .insert({
          client_id: clientId,
          object_id: unit.id,
          amount: unit.price ?? 0,
          paid_amount: 0,
          currency: unit.currency,
          status: "draft",
          payment_type: "full",
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? t.common.error);

      // Flip the cell to "reserved" immediately in local state -- don't
      // wait on (or depend on) the DB-side status trigger to see it, so the
      // click always gives instant feedback even if that trigger is ever
      // missing or slow. A background reload still reconciles with the
      // server shortly after.
      setUnits((prev) =>
        prev.map((u) => (u.id === unit.id ? { ...u, status: "reserved" } : u))
      );
      setContractsByUnit((prev) => ({
        ...prev,
        [unit.id]: {
          id: data.id,
          clientName: "Без клиента (быстрая бронь)",
          remaining: unit.price ?? 0,
          currency: unit.currency,
          paymentsCount: 0,
          isQuickBooking: true,
        },
      }));
      setToast({ message: t.buildings.quickBooked, type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : t.common.error,
        type: "error",
      });
    } finally {
      setPendingQuickBook((prev) => {
        const next = new Set(prev);
        next.delete(unit.id);
        return next;
      });
    }
  };

  // Right-click again on a unit that was quick-booked (and still has
  // nothing paid on it) undoes it -- deletes that placeholder contract and
  // frees the unit back up. Only ever targets the shared placeholder
  // client's own untouched bookings (guarded by isQuickBooking above), so
  // this can never silently delete a real buyer's contract or one with a
  // payment already recorded against it.
  const handleCancelQuickBook = async (unit: PropertyObject, contractId: string) => {
    if (pendingQuickBook.has(unit.id)) return;
    setPendingQuickBook((prev) => new Set(prev).add(unit.id));
    const supabase = createClient();
    try {
      const { error } = await supabase
        .schema("crm")
        .from("contracts")
        .delete()
        .eq("id", contractId);
      if (error) throw new Error(error.message);

      setUnits((prev) =>
        prev.map((u) => (u.id === unit.id ? { ...u, status: "available" } : u))
      );
      setContractsByUnit((prev) => {
        const next = { ...prev };
        delete next[unit.id];
        return next;
      });
      setToast({ message: t.buildings.quickBookCancelled, type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : t.common.error,
        type: "error",
      });
    } finally {
      setPendingQuickBook((prev) => {
        const next = new Set(prev);
        next.delete(unit.id);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/buildings" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.buildings.backToList}
      </Link>

      {!configured && <SetupNotice />}

      {configured && building === undefined && (
        <p className="text-slate-400">{t.common.loading}</p>
      )}
      {configured && building === null && (
        <p className="text-slate-400">{t.buildings.notFound}</p>
      )}

      {building && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{building.name}</h1>
              {building.address && <p className="text-sm text-slate-500">{building.address}</p>}
            </div>
            {role === "admin" && (
              <Link
                href={`/buildings/${building.id}/edit`}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t.buildings.configure}
              </Link>
            )}
          </div>

          <ShakhmatkaGrid
            units={units}
            contractsByUnit={contractsByUnit}
            onBookUnit={setBookingUnit}
            onQuickBook={handleQuickBook}
            onCancelQuickBook={handleCancelQuickBook}
            pendingUnitIds={pendingQuickBook}
            onMergeUnits={handleMergeUnits}
            canEditSold={role === "admin"}
            onViewUnit={setViewingUnit}
          />

          {bookingUnit && (
            <ContractBookingModal
              unit={bookingUnit}
              buildingName={building.name}
              onClose={() => setBookingUnit(null)}
              onBooked={loadUnits}
            />
          )}

          {viewingUnit && (
            <Modal title={viewingUnit.name} onClose={() => setViewingUnit(null)}>
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-xs text-slate-400">{t.buildings.viewOnlyHint}</p>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.objects.form.status}</span>
                  <span className="font-medium text-slate-900">
                    {t.buildings.legend[viewingUnit.status]}
                  </span>
                </div>
                {viewingUnit.rooms != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t.buildings.hover.rooms}</span>
                    <span className="font-medium text-slate-900">{viewingUnit.rooms}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.buildings.hover.area}</span>
                  <span className="font-medium text-slate-900">
                    {formatArea(viewingUnit.area)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.buildings.hover.price}</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(viewingUnit.price, viewingUnit.currency)}
                  </span>
                </div>
                {contractsByUnit[viewingUnit.id] && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t.buildings.hover.owner}</span>
                      <span className="font-medium text-slate-900">
                        {contractsByUnit[viewingUnit.id].clientName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t.buildings.hover.remaining}</span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(
                          contractsByUnit[viewingUnit.id].remaining,
                          contractsByUnit[viewingUnit.id].currency
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Modal>
          )}
        </>
      )}
      <Toast
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((prev) => ({ ...prev, message: null }))}
      />
    </div>
  );
}
