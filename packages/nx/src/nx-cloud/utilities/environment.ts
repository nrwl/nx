import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isCI } from '../../utils/is-ci';
import { workspaceRoot } from '../../utils/workspace-root';

// Set once
export const UNLIMITED_TIMEOUT = 9999999;
process.env.NX_CLOUD_AGENT_TIMEOUT_MS
  ? Number(process.env.NX_CLOUD_AGENT_TIMEOUT_MS)
  : 3600000;
// 60 minutes
process.env.NX_CLOUD_ORCHESTRATOR_TIMEOUT_MS
  ? Number(process.env.NX_CLOUD_ORCHESTRATOR_TIMEOUT_MS)
  : 3600000;
// 60 minutes
process.env.NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT
  ? Number(process.env.NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT)
  : null;
process.env.NX_CLOUD_NUMBER_OF_RETRIES
  ? Number(process.env.NX_CLOUD_NUMBER_OF_RETRIES)
  : isCI()
  ? 10
  : 1;
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
