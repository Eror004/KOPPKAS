export const APP_ROLES = [
  "ketua_pemuda",
  "wakil_ketua_pemuda",
  "sekretaris",
  "bendahara",
  "ketua_rw_01",
  "ketua_rt_01",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  ketua_pemuda: "Ketua Pemuda",
  wakil_ketua_pemuda: "Wakil Ketua Pemuda",
  sekretaris: "Sekretaris",
  bendahara: "Bendahara",
  ketua_rw_01: "Ketua RW 01",
  ketua_rt_01: "Ketua RT 01",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}