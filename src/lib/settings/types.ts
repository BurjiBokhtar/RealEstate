export type Settings = {
  id: boolean;
  // A label for the admin's own reference, not a switch: the code only
  // speaks Payom.tj's request format (see sendPaymentReminders.ts). Renaming
  // this does not change which gateway receives the message.
  sms_provider: string;
  sms_api_key: string | null;
  sms_sender_name: string | null;
  sms_reminder_days: number;
  sms_payment_template: string | null;
  // Sent on the due date itself -- kept separate from sms_payment_template
  // (the "N days before" wording) so a day-of message can say "сегодня",
  // not the advance wording with today's own date filled into {{due_date}}.
  sms_due_today_template: string | null;
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
  // The hero's shape (gradient/flat/outline/block), independent of its
  // colour. See migration 059.
  hero_style: string | null;
  updated_at: string;
};

export type SettingsInput = {
  sms_provider: string;
  sms_api_key: string;
  sms_sender_name: string;
  sms_reminder_days: string;
  sms_payment_template: string;
  sms_due_today_template: string;
  sms_task_template: string;
  company_name: string;
  company_director: string;
  company_address: string;
  company_bank_details: string;
  company_logo_url: string;
  hero_theme: string;
  hero_pattern: string;
  hero_style: string;
};
