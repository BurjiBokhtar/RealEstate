export type Settings = {
  id: boolean;
  sms_api_key: string | null;
  sms_sender_name: string | null;
  sms_reminder_days: number;
  sms_payment_template: string | null;
  sms_task_template: string | null;
  // The Start/Stop switch for the automatic mailout, plus the last run, so
  // Settings can show that the schedule is alive.
  sms_enabled: boolean;
  sms_last_run_at: string | null;
  sms_last_result: string | null;
  company_name: string | null;
  company_director: string | null;
  company_address: string | null;
  company_bank_details: string | null;
  company_logo_url: string | null;
  // Company-wide dashboard hero look (admin-set). Each user may still override
  // locally; when they haven't, this is what everyone sees.
  hero_theme: string | null;
  hero_pattern: string | null;
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
  hero_theme: string;
  hero_pattern: string;
};
