export function getDashboardReturnPath(
  value: FormDataEntryValue | null,
): string {
  if (
    typeof value === "string" &&
    (value === "/dashboard" || value.startsWith("/dashboard/"))
  ) {
    return value;
  }

  return "/dashboard";
}
