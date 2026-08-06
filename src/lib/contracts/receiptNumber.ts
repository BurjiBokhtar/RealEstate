// A receipt's number is "which payment this is" for the contract: the first
// money actually received is №1, the second №2, and so on.
//
// It used to be the row's position among ALL of the contract's rows -- the
// paid ones AND the whole unpaid installment plan -- ordered by due_date. On a
// 30-month plan that made the first real receipt come out as №21 and the next
// as №24, because two dozen future scheduled rows sat "before" them by date.
// The numbers looked random, which is exactly how it was reported. Scheduled
// rows are not receipts; only money that arrived gets a number.
//
// Still derived rather than stored, so it cannot drift out of step with the
// payment chain -- with the consequence that removing an earlier receipt
// renumbers the later ones.
export function receiptNumberFor<
  T extends { id: string; due_date: string; paid: boolean; paid_date: string | null },
>(payments: T[], paymentId: string): number {
  const receipts = payments
    .filter((p) => p.paid)
    .sort((a, b) => {
      const byDate = (a.paid_date ?? a.due_date).localeCompare(b.paid_date ?? b.due_date);
      if (byDate !== 0) return byDate;
      // Two receipts on the same day must still order the same way every
      // time. Without this the answer would depend on the order the caller
      // happened to fetch the rows in, and the number printed on the receipt
      // could disagree with the one in the payment list. id is unique and
      // never changes.
      return a.id.localeCompare(b.id);
    });
  const index = receipts.findIndex((p) => p.id === paymentId);
  return index === -1 ? 0 : index + 1;
}
