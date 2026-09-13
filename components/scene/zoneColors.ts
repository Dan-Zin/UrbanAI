import type { ZoneKind } from "@/services/osm";

/** ArcGIS-Urban-style land-use colours. */
export const ZONE_COLORS: Record<ZoneKind, string> = {
  residential: "#d9c552",
  commercial: "#d95252",
  industrial: "#9a6fd0",
  retail: "#e08f3c",
  education: "#4f9dd9",
  green: "#3d8f57",
  water: "#3d7ab5",
};
