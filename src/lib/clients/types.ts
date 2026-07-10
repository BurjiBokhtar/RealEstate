export const LEAD_STATUSES = [
  "new",
  "contacted",
  "negotiation",
  "client",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  passport: string | null;
  source: string | null;
  status: LeadStatus;
  interested_object_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientInput = {
  name: string;
  phone: string;
  email: string;
  passport: string;
  source: string;
  status: LeadStatus;
  interested_object_id: string;
  notes: string;
};
