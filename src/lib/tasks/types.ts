export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatusValue = (typeof TASK_STATUSES)[number];

export type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatusValue;
  assignee: string | null;
  assignee_phone: string | null;
  client_id: string | null;
  object_id: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskInput = {
  title: string;
  description: string;
  due_date: string;
  status: TaskStatusValue;
  assignee: string;
  assignee_phone: string;
  client_id: string;
  object_id: string;
};
