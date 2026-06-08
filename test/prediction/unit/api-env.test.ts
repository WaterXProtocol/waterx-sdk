import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveApiEnvironment } from "../helpers/api-env.ts";

describe("resolveApiEnvironment", () => {
  let tmpDir: string;
  const prevEnv = { ...process.env };

  beforeEach(() => {
    tmpDir = join(process.cwd(), "test/prediction/unit/.tmp-api-env");
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      join(tmpDir, "local.json"),
      JSON.stringify({ name: "local", baseUrl: "http://localhost:3003" }),
    );
    writeFileSync(join(tmpDir, "staging.json"), JSON.stringify({ name: "staging", baseUrl: "" }));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    process.env = { ...prevEnv };
  });

  it("loads baseUrl from environment file", () => {
    const env = resolveApiEnvironment({ envName: "local", environmentsDir: tmpDir });
    expect(env).toEqual({ name: "local", baseUrl: "http://localhost:3003" });
  });

  it("returns null when file baseUrl is empty and no override", () => {
    const env = resolveApiEnvironment({ envName: "staging", environmentsDir: tmpDir });
    expect(env).toBeNull();
  });

  it("uses JSON baseUrl when set even if E2E_API_BASE_URL points elsewhere", () => {
    process.env.E2E_API_BASE_URL = "http://localhost:3003";
    writeFileSync(
      join(tmpDir, "staging.json"),
      JSON.stringify({ name: "staging", baseUrl: "https://api.example.com" }),
    );
    const env = resolveApiEnvironment({ envName: "staging", environmentsDir: tmpDir });
    expect(env?.baseUrl).toBe("https://api.example.com");
  });

  it("falls back to E2E_API_BASE_URL when JSON baseUrl is empty", () => {
    process.env.E2E_API_BASE_URL = "https://override.example.com/";
    const env = resolveApiEnvironment({ envName: "staging", environmentsDir: tmpDir });
    expect(env?.baseUrl).toBe("https://override.example.com");
  });

  it("includes jwt from E2E_API_JWT", () => {
    process.env.E2E_API_JWT = "test-token";
    const env = resolveApiEnvironment({ envName: "local", environmentsDir: tmpDir });
    expect(env?.jwt).toBe("test-token");
  });

  it("strips trailing slash from baseUrl", () => {
    const env = resolveApiEnvironment({
      envName: "local",
      baseUrlOverride: "http://localhost:3003/",
      environmentsDir: tmpDir,
    });
    expect(env?.baseUrl).toBe("http://localhost:3003");
  });

  it("returns null for unknown environment name", () => {
    const env = resolveApiEnvironment({ envName: "unknown", environmentsDir: tmpDir });
    expect(env).toBeNull();
  });
});
