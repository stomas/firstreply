export function clientSafeOutboundText(value: string): string {
  return /\bresend\b/iu.test(value)
    ? "El. pašto siuntimo paslaugos klaida."
    : value;
}
