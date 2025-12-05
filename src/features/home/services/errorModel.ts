import type { HomeError } from "@/features/home/types/home";

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  { attempts = 3, baseDelayMs = 500 }: RetryOptions = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) {
        break;
      }
      const wait = baseDelayMs * Math.pow(2, attempt);
      await sleep(wait);
    }
  }

  throw lastError;
}

export function toHomeError(error: unknown): HomeError {
  if (typeof error === "object" && error !== null) {
    const message = extractMessage(error);

    return { kind: "unknown", message };
  }

  return { kind: "unknown", message: String(error) };
}

function extractMessage(error: { message?: unknown }): string {
  if (typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}

function sleep(duration: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}
