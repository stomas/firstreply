export type SuperAdminEnv = {
  NODE_ENV?: string;
  SUPER_ADMIN_ENABLED?: string;
};

export function isSuperAdminEnabled(env: SuperAdminEnv = process.env): boolean {
  return env.SUPER_ADMIN_ENABLED === "true" || env.NODE_ENV !== "production";
}
