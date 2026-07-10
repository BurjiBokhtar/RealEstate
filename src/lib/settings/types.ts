export type Settings = {
  id: boolean;
  usd_rate: number;
  sms_api_key: string | null;
  sms_sender_name: string | null;
  sms_reminder_days: number;
  updated_at: string;
};

export type SettingsInput = {
  usd_rate: string;
  sms_api_key: string;
  sms_sender_name: string;
  sms_reminder_days: string;
};
