import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { workspaceRoot } from '../../utils/workspace-root';

// Set once
export const UNLIMITED_TIMEOUT = 9999999;
export let ACCESS_TOKEN;
export let NX_CLOUD_NO_TIMEOUTS;

loadEnvVars();
function parseEnv() {
  try {
    const envContents = readFileSync(join(workspaceRoot, 'nx-cloud.env'));
    return dotenv.parse(envContents);
  } catch (e) {
    return {};
  }
}

function loadEnvVars() {
  const parsed = parseEnv();
  ACCESS_TOKEN =
    process.env.NX_CLOUD_AUTH_TOKEN ||
    process.env.NX_CLOUD_ACCESS_TOKEN ||
    parsed.NX_CLOUD_AUTH_TOKEN ||
    parsed.NX_CLOUD_ACCESS_TOKEN;
  NX_CLOUD_NO_TIMEOUTS =
    process.env.NX_CLOUD_NO_TIMEOUTS === 'true' ||
    parsed.NX_CLOUD_NO_TIMEOUTS === 'true';
}
