import { createClient } from "@supabase/supabase-js";

function makeServiceClient(url: string, key: string) {
  return createClient(url, key, { db: { schema: "crm" } });
}

type ServiceClient = ReturnType<typeof makeServiceClient>;

export function getServiceClient(): ServiceClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return makeServiceClient(supabaseUrl, serviceRoleKey);
}

export async function requireUser(supabase: ServiceClient, request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export type ContractSendData = {
  id: string;
  number: string | null;
  amount: number;
  paid_amount: number;
  currency: string;
  signed_date: string | null;
  client: { name: string; phone: string | null; email: string | null } | null;
  object: { name: string } | null;
};

export type PaymentSendData = {
  id: string;
  due_date: string;
  amount: number;
  paid: boolean;
  paid_date: string | null;
};

export type CompanySettings = {
  company_name: string | null;
  company_logo_url: string | null;
};

export async function fetchContract(
  supabase: ServiceClient,
  contractId: string
): Promise<ContractSendData | null> {
  const { data } = await supabase
    .from("contracts")
    .select(
      "id, number, amount, paid_amount, currency, signed_date, client:clients(name, phone, email), object:objects(name)"
    )
    .eq("id", contractId)
    .maybeSingle();
  return (data as unknown as ContractSendData) ?? null;
}

export async function fetchPayment(
  supabase: ServiceClient,
  paymentId: string
): Promise<PaymentSendData | null> {
  const { data } = await supabase
    .from("contract_payments")
    .select("id, due_date, amount, paid, paid_date")
    .eq("id", paymentId)
    .maybeSingle();
  return (data as unknown as PaymentSendData) ?? null;
}

export async function fetchSettings(supabase: ServiceClient): Promise<CompanySettings> {
  const { data } = await supabase
    .from("settings")
    .select("company_name, company_logo_url")
    .maybeSingle();
  return (data as unknown as CompanySettings) ?? { company_name: null, company_logo_url: null };
}

// Best-effort E.164 normalization for Tajik numbers: strips everything but
// digits, and prefixes the 992 country code onto bare 9-digit local numbers.
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("992")) return `+${digits}`;
  if (digits.length === 9) return `+992${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}
