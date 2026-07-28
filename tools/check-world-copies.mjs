/**
 * Verifies the per-world duplicate scripts are still byte-identical.
 *
 * A script path listed in several content_scripts entries is injected into a document
 * only once, so the isolated and MAIN worlds each need their own copy of the shared
 * files. Nothing at runtime notices when the copies drift, hence this check.
 *
 *   node tools/check-world-copies.mjs        report differences (exit 1 if any)
 *   node tools/check-world-copies.mjs --fix  copy the source over the world copy
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** [source of truth, world copy] */
const PAIRS = [
  ["src/fb-channel.js", "src/fb-channel-main.js"],
  ["src/security-defaults.js", "src/security-defaults-main.js"],
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fix = process.argv.includes("--fix");
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

let failed = false;
for (const [src, copy] of PAIRS) {
  const srcBuf = readFileSync(resolve(root, src));
  let copyBuf = null;
  try {
    copyBuf = readFileSync(resolve(root, copy));
  } catch {
    copyBuf = null;
  }

  if (copyBuf && sha(srcBuf) === sha(copyBuf)) {
    console.log(`ok       ${src} == ${copy}`);
    continue;
  }
  if (fix) {
    writeFileSync(resolve(root, copy), srcBuf);
    console.log(`fixed    ${copy} <- ${src}`);
    continue;
  }
  failed = true;
  console.error(`DRIFTED  ${copy} differs from ${src} (run with --fix)`);
}

process.exit(failed ? 1 : 0);
