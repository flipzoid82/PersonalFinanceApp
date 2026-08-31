import { describe, expect, it } from "vitest";
import { ImportConfigurationError, parseImportConfig } from "./config";

describe("import configuration", () => {
  it("requires a dedicated 32-byte hexadecimal key", () => {
    expect(() =>
      parseImportConfig({ IMPORT_FILE_ENCRYPTION_KEY: "short" }),
    ).toThrow(ImportConfigurationError);
    expect(() =>
      parseImportConfig({
        IMPORT_FILE_ENCRYPTION_KEY: "1".repeat(64),
        TOKEN_ENCRYPTION_KEY: "1".repeat(64),
      }),
    ).toThrow(ImportConfigurationError);
  });

  it("fails closed in production when explicit import configuration is absent", () => {
    expect(() => parseImportConfig({ NODE_ENV: "production" })).toThrow(
      ImportConfigurationError,
    );
  });

  it("uses the ignored runtime directory by default without exposing the key", () => {
    const result = parseImportConfig({
      IMPORT_FILE_ENCRYPTION_KEY: "2".repeat(64),
    });
    expect(result.storageDirectory.replaceAll("\\", "/")).toMatch(
      /\.dev-runtime\/imports$/,
    );
    expect(JSON.stringify(result.storageDirectory)).not.toContain(
      "2".repeat(64),
    );
  });
});
