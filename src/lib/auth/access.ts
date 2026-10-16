// What a person may do in each part of the program.
//
// A ROLE (admin / manager / director / accountant / procurement) gives a
// default level for two areas -- sales of flats (clients, contracts, the chess
// grid, objects, tasks, debtors, rentals) and finance. The administrator can
// override either area for a person (Settings -> Staff): a manager who also
// keeps the books, an accountant who needs to see sales. This mirrors
// crm.my_sales_level() / crm.my_finance_level() in the database; the database is
// the real lock, this only decides what the interface offers.
//
// Finance has one level more than sales: "own" -- the person buys for the
// company and sees and enters only their own expenses (and the cash issued to
// them). It is neither reading nor writing the company's books.

export type Level = "none" | "read" | "write";
export type FinanceLevel = Level | "own";

export const isLevel = (v: unknown): v is Level => v === "none" || v === "read" || v === "write";
export const isFinanceLevel = (v: unknown): v is FinanceLevel => v === "own" || isLevel(v);

export type Access = { sales: Level; finance: FinanceLevel };

const BY_ROLE: Record<string, Access> = {
  admin: { sales: "write", finance: "write" },
  manager: { sales: "write", finance: "none" },
  director: { sales: "read", finance: "read" },
  accountant: { sales: "none", finance: "write" },
  procurement: { sales: "none", finance: "own" },
};

export const NO_ACCESS: Access = { sales: "none", finance: "none" };

export function defaultAccess(role: string): Access {
  return BY_ROLE[role] ?? NO_ACCESS;
}

export function effectiveAccess(role: string, salesOverride?: unknown, financeOverride?: unknown): Access {
  const base = defaultAccess(role);
  // An admin cannot be locked out by an override.
  if (role === "admin") return base;
  return {
    sales: isLevel(salesOverride) ? salesOverride : base.sales,
    finance: isFinanceLevel(financeOverride) ? financeOverride : base.finance,
  };
}

// "own" is deliberately neither: it never opens the company's books.
export const canView = (level: FinanceLevel) => level === "read" || level === "write";
export const canWrite = (level: FinanceLevel) => level === "write";
export const isOwnOnly = (level: FinanceLevel) => level === "own";
