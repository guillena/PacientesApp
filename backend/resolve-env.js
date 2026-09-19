/**
 * resolve-env.js
 *
 * Runs before the application starts (via the `prestart` npm hook).
 * Railway injects service reference variables (e.g. ${{ kumespacio-files.REGION }})
 * directly into process.env at runtime, but dotenv only reads from the .env file.
 * This script bridges the gap by writing those runtime values into .env so that
 * dotenv.config() picks them up consistently on every require.
 *
 * Variables written here will NOT override values already present in .env
 * (existing lines are left untouched; only missing keys are appended).
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '.env');

// The bucket-related variables Railway injects via service references.
const BUCKET_VARS = [
  'BUCKET_NAME',
  'BUCKET',
  'REGION',
  'ENDPOINT',
  'ACCESS_KEY_ID',
  'SECRET_ACCESS_KEY',
];

if (process.env.BUCKET && !process.env.BUCKET_NAME) {
  process.env.BUCKET_NAME = process.env.BUCKET;
}

// ---------------------------------------------------------------------------
// Read the existing .env file (if any) and parse the keys already defined.
// ---------------------------------------------------------------------------
let existingContent = '';
const existingKeys = new Set();

if (fs.existsSync(ENV_FILE)) {
  existingContent = fs.readFileSync(ENV_FILE, 'utf8');
  for (const line of existingContent.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and blank lines.
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex !== -1) {
      existingKeys.add(trimmed.slice(0, eqIndex).trim());
    }
  }
}

// ---------------------------------------------------------------------------
// Build the lines to append for any bucket variable that:
//   1. Is present in process.env (injected by Railway), AND
//   2. Is NOT already defined in the .env file.
// ---------------------------------------------------------------------------
const linesToAppend = [];

for (const key of BUCKET_VARS) {
  const value = process.env[key];

  if (value === undefined || value === null) {
    console.warn(`[resolve-env] Warning: ${key} is not set in the environment — skipping.`);
    continue;
  }

  if (existingKeys.has(key)) {
    console.log(`[resolve-env] ${key} already present in .env — skipping.`);
    continue;
  }

  // Wrap the value in double-quotes and escape any existing double-quotes
  // so the resulting .env line is always valid.
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  linesToAppend.push(`${key}="${escaped}"`);
  console.log(`[resolve-env] Writing ${key} to .env`);
}

// ---------------------------------------------------------------------------
// Append the new lines to .env (with a leading newline for clean formatting).
// ---------------------------------------------------------------------------
if (linesToAppend.length > 0) {
  const separator = existingContent.endsWith('\n') || existingContent === '' ? '' : '\n';
  fs.appendFileSync(ENV_FILE, `${separator}${linesToAppend.join('\n')}\n`, 'utf8');
  console.log(`[resolve-env] Appended ${linesToAppend.length} variable(s) to .env`);
} else {
  console.log('[resolve-env] No new variables to write — .env is up to date.');
}
