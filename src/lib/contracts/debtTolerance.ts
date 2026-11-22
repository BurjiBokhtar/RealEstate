// A shortfall below this (in the contract's own currency) is rounding dust, not
// a debt: instalments are split into fractions (8 333,33) while clients pay
// round sums (8 333), and the missing 0,33 must not put anyone on the debtors
// list. Keep it equal to crm.debt_tolerance() in the database (block 087) --
// the debtors page, the dashboard and the contract card then agree.
export const DEBT_TOLERANCE = 1;
