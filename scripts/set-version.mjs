#!/usr/bin/env node
/**
 * Writes the version semantic-release decided on into src/manifest.json.
 *
 * The manifest is the only place a browser extension carries its version, and
 * it does NOT accept full semver: Chrome wants 1-4 dot-separated integers up to
 * 65535, and AMO rejects pre-release tags outright. semantic-release will
 * happily hand us "1.2.0-beta.1" if a prerelease branch is ever configured, so
 * fail loudly here rather than shipping a package no store will accept.
 */
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
const manifestPath = new URL("../src/manifest.json", import.meta.url);

if (!version) {
  console.error("usage: node scripts/set-version.mjs <version>");
  process.exit(1);
}

const parts = version.split(".");
const valid =
  parts.length >= 1 &&
  parts.length <= 4 &&
  parts.every((p) => /^\d+$/.test(p) && Number(p) <= 65535);

if (!valid) {
  console.error(
    `[holy-shelf] "${version}" is not a valid extension version.\n` +
      "Manifest versions must be 1-4 dot-separated integers (0-65535), with no\n" +
      "pre-release suffix. Keep semantic-release on release branches only."
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = version;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`[holy-shelf] manifest version -> ${version}`);
