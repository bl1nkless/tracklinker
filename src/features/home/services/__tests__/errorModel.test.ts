import { describe, expect, it } from "vitest";
import { toHomeError, withRetry } from "@/features/home/services/errorModel";

describe("toHomeError", () => {
  it("wraps unknown values as unknown error", () => {
    const error = toHomeError("boom");
    expect(error).toEqual({ kind: "unknown", message: "boom" });
  });

  it("extracts message from Error objects", () => {
    const error = toHomeError(new Error("network down"));
    expect(error).toEqual({ kind: "unknown", message: "network down" });
  });
});

describe("withRetry", () => {
  it("retries the specified number of times", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts += 1;
          throw new Error("fail");
        },
        { attempts: 2, baseDelayMs: 1 }
      )
    ).rejects.toThrow("fail");
    expect(attempts).toBe(2);
  });

  it("resolves when operation succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("temp");
        }
        return "done";
      },
      { attempts: 3, baseDelayMs: 1 }
    );
    expect(result).toBe("done");
  });
});
