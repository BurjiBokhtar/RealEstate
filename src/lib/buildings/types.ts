import type { ObjectStatus } from "@/lib/objects/types";

export const CONSTRUCTION_STATUSES = ["planning", "in_progress", "completed"] as const;
export type ConstructionStatus = (typeof CONSTRUCTION_STATUSES)[number];

export type Building = {
  id: string;
  name: string;
  address: string | null;
  floors_count: number | null;
  units_per_floor: number | null;
  price_per_sqm: number | null;
  facade_url: string | null;
  plan_url: string | null;
  construction_status: ConstructionStatus;
  created_at: string;
  updated_at: string;
};

export type BuildingInput = {
  name: string;
  address: string;
  floors_count: string;
  units_per_floor: string;
  price_per_sqm: string;
  facade_url: string;
  plan_url: string;
  construction_status: ConstructionStatus;
};

export const emptyBuildingInput: BuildingInput = {
  name: "",
  address: "",
  floors_count: "",
  units_per_floor: "",
  price_per_sqm: "",
  facade_url: "",
  plan_url: "",
  construction_status: "in_progress",
};

export type BuildingUnit = {
  id: string;
  name: string;
  status: ObjectStatus;
  area: number | null;
  price: number | null;
  floor: number;
  position_in_floor: number;
};
