export class AppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppConfigError";
  }
}

export class AppNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppNotFoundError";
  }
}

export class AppValidationError extends Error {
  constructor(
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppValidationError";
  }
}

export class AppAuthenticationError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AppAuthenticationError";
  }
}

export class AppAuthorizationError extends Error {
  constructor(message = "Access denied.") {
    super(message);
    this.name = "AppAuthorizationError";
  }
}

export function getAppErrorMessage(error: unknown): string {
  if (error instanceof AppConfigError) {
    return error.message;
  }

  if (error instanceof AppNotFoundError) {
    return error.message;
  }

  if (error instanceof AppValidationError) {
    return error.message;
  }

  if (error instanceof AppAuthenticationError) {
    return "Prisijungimo sesija nebegalioja. Prisijunkite iš naujo.";
  }

  if (error instanceof AppAuthorizationError) {
    return "Neturite teisės atlikti šio veiksmo.";
  }

  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    return "DATABASE_URL is not configured.";
  }

  return "Nepavyko nuskaityti duomenų iš DB.";
}
