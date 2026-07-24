"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ShakhmatkaGrid, type UnitContractInfo } from "@/components/ShakhmatkaGrid";
import { Modal } from "@/components/Modal";
import { ContractBookingModal } from "@/components/ContractBookingModal";
import { QuickAddUnitModal } from "@/components/QuickAddUnitModal";
import { UnitEditModal } from "@/components/UnitEditModal";
import { Toast, type ToastType } from "@/components/Toast";
import { computeApartmentNumbers } from "@/lib/buildings/apartmentNumbers";
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
  const [addingUnit, setAddingUnit] = useState<{
    floor: number;
    block: string;
    position: number;
  } | null>(null);
  const [pendingQuickBook, setPendingQuickBook] = useState<Set<string>>(new Set());
  const [resyncing, setResyncing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState<{ message: string | null; type: ToastType }>({
    message: null,
    type: "success",
  });
  const { role } = useRole();

  const apartmentNumbers = useMemo(() => computeApartmentNumbers(units), [units]);

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
        .select("id, object_id, amount, paid_amount, currency, client:clients(name, phone, source)")
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
        client: { name: string; phone: string | null; source: string | null } | null;
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
          clientPhone: c.client?.phone ?? null,
          amount: c.amount,
          paid: c.paid_amount,
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

  // Right-click toggles a hand reservation on the unit itself -- no
  // contract, no client attached, exactly "придержи эту квартиру". The
  // toggle is one SECURITY DEFINER RPC that flips objects.manual_reserved
  // and recomputes the status, so a second right-click always frees the
  // unit back up.
  const handleQuickBook = async (unit: PropertyObject) => {
    if (role === "director") return;
    if (pendingQuickBook.has(unit.id)) return;
    const existing = contractsByUnit[unit.id];
    if (existing) {
      // Legacy placeholder bookings (old flow that created a stub contract)
      // still cancel; a real buyer's contract explains itself instead of
      // silently doing nothing.
      if (existing.isQuickBooking) {
        await handleCancelQuickBook(unit, existing.id);
      } else {
        setToast({ message: t.buildings.cannotUnbookReal, type: "error" });
      }
      return;
    }

    setPendingQuickBook((prev) => new Set(prev).add(unit.id));
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .schema("crm")
        .rpc("toggle_manual_reservation", { p_object_id: unit.id });
      if (error) throw new Error(error.message);
      const nowReserved = Boolean(data);

      // Instant local feedback; a later reload reconciles with the server.
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unit.id
            ? {
                ...u,
                manual_reserved: nowReserved,
                status: nowReserved ? "reserved" : "available",
              }
            : u
        )
      );
      setToast({
        message: nowReserved ? t.buildings.quickBooked : t.buildings.quickBookCancelled,
        type: "success",
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : t.common.error,
        type: "error",
      });
      await loadUnits();
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
      const { error } = await supabase.schema("crm").rpc("cancel_quick_booking", {
        p_contract_id: contractId,
      });
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

  // Manual escape hatch: the DB trigger that keeps a unit's status in sync
  // with its contract's paid_amount is supposed to make this automatic and
  // instant, but in case that trigger is ever missing, mid-deploy, or just
  // hasn't been applied to this Supabase project yet, this recomputes every
  // unit's status from its actual contracts server-side and re-fetches --
  // a reliable way out that doesn't depend on the trigger having worked.
  const handleResyncStatuses = async () => {
    setResyncing(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.schema("crm").rpc("resync_all_object_statuses");
      if (error) throw new Error(error.message);
      await loadUnits();
      setToast({ message: t.buildings.resyncDone, type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : t.common.error,
        type: "error",
      });
    } finally {
      setResyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/buildings">{t.buildings.backToList}</BackLink>

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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResyncStatuses}
                  disabled={resyncing}
                  title={t.buildings.resyncHint}
                  className="group inline-flex items-center gap-2 rounded-lg border border-[#5b3468]/40 bg-white px-4 py-2 text-sm font-medium text-[#5b3468] shadow-sm transition-all hover:border-[#5b3468] hover:bg-purple-50 hover:shadow active:scale-[0.98] disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className={`text-base leading-none transition-transform duration-500 ${resyncing ? "animate-spin" : "group-hover:rotate-180"}`}
                  >
                    ⟳
                  </span>
                  {resyncing ? t.common.loading : t.buildings.resyncStatuses}
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all active:scale-[0.98] ${
                    editMode
                      ? "border-amber-400 bg-amber-100 text-amber-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span aria-hidden="true" className="text-base leading-none">✎</span>
                  {editMode ? t.buildings.editModeOn : t.buildings.editMode}
                </button>
                <Link
                  href={`/buildings/${building.id}/edit`}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1c1a3a] to-[#5b3468] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 active:scale-[0.98]"
                >
                  <span aria-hidden="true" className="text-base leading-none">⚙</span>
                  {t.buildings.configure}
                </Link>
              </div>
            )}
          </div>

          {editMode && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              {t.buildings.editModeHint}
            </div>
          )}

          <ShakhmatkaGrid
            editMode={editMode}
            units={units}
            contractsByUnit={contractsByUnit}
            readOnly={role === "director"}
            onBookUnit={setBookingUnit}
            onQuickBook={handleQuickBook}
            onCancelQuickBook={handleCancelQuickBook}
            onAddUnit={(floor, block, position) => setAddingUnit({ floor, block, position })}
            pendingUnitIds={pendingQuickBook}
            onMergeUnits={handleMergeUnits}
            canEditSold={role === "admin"}
            onViewUnit={setViewingUnit}
          />

          {addingUnit && (
            <QuickAddUnitModal
              buildingId={building.id}
              floor={addingUnit.floor}
              block={addingUnit.block}
              position={addingUnit.position}
              siblingUnit={units.find(
                (u) => (u.block ?? "") === addingUnit.block && u.position_in_floor === addingUnit.position
              )}
              onClose={() => setAddingUnit(null)}
              onAdded={loadUnits}
            />
          )}

          {bookingUnit && (
            <ContractBookingModal
              unit={bookingUnit}
              buildingName={building.name}
              apartmentNumber={apartmentNumbers.get(bookingUnit.id)}
              onClose={() => setBookingUnit(null)}
              onBooked={loadUnits}
            />
          )}

          {viewingUnit && (
            <UnitEditModal
              unit={viewingUnit}
              allUnits={units}
              apartmentNumber={apartmentNumbers.get(viewingUnit.id)}
              canEdit={role === "admin"}
              onClose={() => setViewingUnit(null)}
              onSaved={() => {
                loadUnits();
              }}
            />
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
