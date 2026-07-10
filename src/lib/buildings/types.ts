import type { ObjectStatus } from "@/lib/objects/types";

export type Building = {
  id: string;
  name: string;
  address: string | null;
  floors_count: number | null;
  units_per_floor: number | null;
  created_at: string;
  updated_at: string;
};

export type BuildingInput = {
  name: string;
  address: string;
  floors_count: string;
  units_per_floor: string;
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
