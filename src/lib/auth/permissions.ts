import type { AppRole } from "./roles";

export type ModuleKey =
  | "dashboard" | "members" | "structure" | "events"
  | "general_finance" | "monthly_dues" | "event_finance"
  | "letters" | "announcements" | "media" | "reports"
  | "notifications" | "activity" | "accounts" | "inbox";

export type PermissionAction = "read" | "create" | "update" | "delete" | "approve" | "manage";

const permissions: Record<AppRole, Partial<Record<ModuleKey, PermissionAction[]>>> = {
  ketua_pemuda: {
    dashboard: ["read"], members: ["read", "create", "update", "delete"], structure: ["read", "create", "update", "delete"],
    events: ["read", "create", "update", "delete", "approve"], general_finance: ["read", "create", "update"],
    monthly_dues: ["read", "create", "update"], event_finance: ["read", "create", "update", "approve"],
    letters: ["read", "create", "update", "approve"], announcements: ["read", "create", "update", "delete"],
    media: ["read", "create", "update", "delete"], reports: ["read"], notifications: ["read", "update"],
    activity: ["read"], accounts: ["read", "create", "update", "delete", "manage"], inbox: ["read"],
  },
  wakil_ketua_pemuda: {
    dashboard: ["read"], members: ["read"], structure: ["read"], events: ["read", "create", "update", "approve"],
    general_finance: ["read", "create", "update"], monthly_dues: ["read", "create", "update"],
    event_finance: ["read", "create", "update", "approve"], letters: ["read", "create", "update", "approve"],
    announcements: ["read", "create", "update"], media: ["read", "create", "update"], reports: ["read"],
    notifications: ["read", "update"], activity: ["read"], inbox: ["read"],
  },
  sekretaris: {
    dashboard: ["read"], members: ["read", "create", "update", "delete"], structure: ["read", "create", "update", "delete"],
    events: ["read", "create", "update"], monthly_dues: ["create"], letters: ["read", "create", "update"],
    announcements: ["read", "create", "update"], media: ["read", "create", "update"], reports: ["read"],
    notifications: ["read", "update"], inbox: ["read"],
  },
  bendahara: {
    dashboard: ["read"], members: ["read"], events: ["read", "create"], monthly_dues: ["read", "create", "update"],
    general_finance: ["read", "create", "update"], event_finance: ["read", "create", "update", "approve"],
    letters: ["read", "create", "update"], reports: ["read"], notifications: ["read", "update"], inbox: ["read"],
  },
  ketua_rw_01: {
    dashboard: ["read"], members: ["read"], structure: ["read"], events: ["read", "create"],
    letters: ["read", "create"], announcements: ["read", "create", "update"], media: ["read", "create", "update"],
    notifications: ["read", "update"], inbox: ["read"],
  },
  ketua_rt_01: {
    dashboard: ["read"], members: ["read"], structure: ["read"], events: ["read", "create"],
    letters: ["read", "create"], announcements: ["read", "create", "update"], media: ["read", "create", "update"],
    notifications: ["read", "update"], inbox: ["read"],
  },
};

export function can(role: AppRole, module: ModuleKey, action: PermissionAction = "read") {
  return permissions[role][module]?.includes(action) ?? false;
}

export function visibleModules(role: AppRole): ModuleKey[] {
  return (Object.keys(permissions[role]) as ModuleKey[]).filter((module) => can(role, module));
}

// INBOX access is confirmed for all six roles. Reply, assignment, status and archive
// mutations are intentionally not granted until the organization confirms their scope.
