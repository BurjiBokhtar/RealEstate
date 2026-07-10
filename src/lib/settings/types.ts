export type Settings = {
  id: boolean;
  sms_api_key: string | null;
  sms_sender_name: string | null;
  sms_reminder_days: number;
  sms_payment_template: string | null;
  sms_task_template: string | null;
  company_name: string | null;
  company_director: string | null;
  company_address: string | null;
  company_bank_details: string | null;
  company_logo_url: string | null;
  updated_at: string;
};

export type SettingsInput = {
  sms_api_key: string;
  sms_sender_name: string;
  sms_reminder_days: string;
  sms_payment_template: string;
  sms_task_template: string;
  company_name: string;
  company_director: string;
  company_address: string;
  company_bank_details: string;
  company_logo_url: string;
};
