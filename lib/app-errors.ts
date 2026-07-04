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

  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    return "DATABASE_URL is not configured.";
  }

  return "Nepavyko nuskaityti duomenų iš DB.";
}
