/** Solar position for Taganrog (47.21°N), fixed mid-June date. */

const LAT = (47.21 * Math.PI) / 180;
const DECL = (23.2 * Math.PI) / 180; // ~June 15 declination

export interface SunState {
  /** Light position on a radius-90 dome, world coords. */
  position: [number, number, number];
  /** Solar altitude in radians (negative = below horizon). */
  altitude: number;
  /** 0 (night) .. 1 (full daylight). */
  daylight: number;
}

export function sunAt(hour: number): SunState {
  const H = ((hour - 12) * 15 * Math.PI) / 180; // hour angle
  const altitude = Math.asin(
    Math.sin(LAT) * Math.sin(DECL) + Math.cos(LAT) * Math.cos(DECL) * Math.cos(H)
  );
  // azimuth measured from north, clockwise
  const azimuth =
    Math.atan2(
      Math.sin(H),
      Math.cos(H) * Math.sin(LAT) - Math.tan(DECL) * Math.cos(LAT)
    ) + Math.PI;

  const R = 90;
  const cosAlt = Math.cos(altitude);
  return {
    position: [
      R * cosAlt * Math.sin(azimuth),
      R * Math.sin(altitude),
      -R * cosAlt * Math.cos(azimuth),
    ],
    altitude,
    daylight: Math.min(1, Math.max(0, Math.sin(altitude) * 1.6)),
  };
}

export function formatHour(hour: number) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
