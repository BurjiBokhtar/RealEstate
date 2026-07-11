// Payments don't have their own DB-stored receipt number -- it's derived by
// ordering a contract's payments chronologically. Keeping it computed (not
// stored) means it can never drift out of sync with the actual payment
// chain, and stays correct even if a payment is edited/removed later.
export function receiptNumberFor<T extends { id: string; due_date: string }>(
  payments: T[],
  paymentId: string
): number {
  const sorted = [...payments].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const index = sorted.findIndex((p) => p.id === paymentId);
  return index === -1 ? 0 : index + 1;
}
