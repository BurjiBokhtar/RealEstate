export const CONTRACT_STATUSES = [
  "draft",
  "active",
  "completed",
  "cancelled",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export type Contract = {
  id: string;
  number: string | null;
  client_id: string;
  object_id: string;
  amount: number;
  paid_amount: number;
  status: ContractStatus;
  signed_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractInput = {
  number: string;
  client_id: string;
  object_id: string;
  amount: string;
  paid_amount: string;
  status: ContractStatus;
  signed_date: string;
  notes: string;
};
