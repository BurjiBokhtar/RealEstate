export const OBJECT_TYPES = [
  "apartment",
  "house",
  "commercial",
  "land",
  "construction_site",
] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

export const OBJECT_STATUSES = [
  "available",
  "reserved",
  "sold",
  "rented",
  "in_progress",
] as const;
export type ObjectStatus = (typeof OBJECT_STATUSES)[number];

export type PropertyObject = {
  id: string;
  name: string;
  address: string | null;
  type: ObjectType;
  status: ObjectStatus;
  area: number | null;
  price: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type PropertyObjectInput = {
  name: string;
  address: string;
  type: ObjectType;
  status: ObjectStatus;
  area: string;
  price: string;
  description: string;
};
