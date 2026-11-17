import { redirect } from "next/navigation";
import { can, type ModuleKey, type PermissionAction } from "./permissions";
import { requireUser } from "./require-user";

export async function requireModulePermission(
  module: ModuleKey,
  action: PermissionAction = "read",
) {
  const user = await requireUser();
  if (!can(user.role, module, action)) redirect("/?reason=forbidden");
  return user;
}