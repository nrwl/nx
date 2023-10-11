import { execSync } from 'child_process';
import { createHash } from 'crypto';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { machineIdSync } from 'node-machine-id';
import { join, parse } from 'path';
import { MachineInfo } from '../core/models/machine-info.model';
import { isCI } from './is-ci';
import { isConnectedToPrivateCloud } from './is-private-cloud';

const { workspaceRoot } = require('./nx-imports-light');

// Set once
export const UNLIMITED_TIMEOUT = 9999999;
export const NO_MESSAGES_TIMEOUT = process.env.NX_CLOUD_AGENT_TIMEOUT_MS
  ? Number(process.env.NX_CLOUD_AGENT_TIMEOUT_MS)
  : 3600000; // 60 minutes
export const NO_COMPLETED_TASKS_TIMEOUT = process.env
  .NX_CLOUD_ORCHESTRATOR_TIMEOUT_MS
  ? Number(process.env.NX_CLOUD_ORCHESTRATOR_TIMEOUT_MS)
  : 3600000; // 60 minutes
export const UNLIMITED_FILE_SIZE = 1000 * 1000 * 10000;
export const NX_CLOUD_UNLIMITED_OUTPUT =
  process.env.NX_CLOUD_UNLIMITED_OUTPUT === 'true';
export const DEFAULT_FILE_SIZE_LIMIT = 1000 * 1000 * 300;
export const DISTRIBUTED_TASK_EXECUTION_INTERNAL_ERROR_STATUS_CODE = 166;
export const NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT = process.env
  .NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT
  ? Number(process.env.NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT)
  : null;
export const NX_CLOUD_DISTRIBUTED_EXECUTION_STOP_AGENTS_ON_FAILURE =
  process.env.NX_CLOUD_DISTRIBUTED_EXECUTION_STOP_AGENTS_ON_FAILURE != 'false';
export const NX_CLOUD_FORCE_METRICS =
  process.env.NX_CLOUD_FORCE_METRICS === 'true';
export const NUMBER_OF_AXIOS_RETRIES = process.env.NX_CLOUD_NUMBER_OF_RETRIES
  ? Number(process.env.NX_CLOUD_NUMBER_OF_RETRIES)
  : isCI()
  ? 10
  : 1;
export const NX_NO_CLOUD = process.env.NX_NO_CLOUD === 'true';

export let ACCESS_TOKEN;
export let ENCRYPTION_KEY;
export let VERBOSE_LOGGING;
export let NX_CLOUD_NO_TIMEOUTS;

loadEnvVars();

export function agentRunningInDistributedExecution(
  distributedExecutionId: string | undefined
) {
  return !!distributedExecutionId;
}

export function nxInvokedByRunner() {
  return (
    process.env.NX_INVOKED_BY_RUNNER === 'true' ||
    process.env.NX_CLOUD === 'false'
  );
}

export function extractGitSha() {
  try {
    return execSync(`git rev-parse HEAD`, { stdio: 'pipe' }).toString().trim();
  } catch (e) {
    return undefined;
  }
}

export function extractGitRef() {
  try {
    return execSync(`git rev-parse --symbolic-full-name HEAD`, {
      stdio: 'pipe',
    })
      .toString()
      .trim();
  } catch (e) {
    return undefined;
  }
}

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
  ENCRYPTION_KEY =
    process.env.NX_CLOUD_ENCRYPTION_KEY || parsed.NX_CLOUD_ENCRYPTION_KEY;
  VERBOSE_LOGGING =
    process.env.NX_VERBOSE_LOGGING === 'true' ||
    parsed.NX_VERBOSE_LOGGING === 'true';
  NX_CLOUD_NO_TIMEOUTS =
    process.env.NX_CLOUD_NO_TIMEOUTS === 'true' ||
    parsed.NX_CLOUD_NO_TIMEOUTS === 'true';
}

export function getCIExecutionId(): string | null {
  if (isConnectedToPrivateCloud()) return undefined as any;
  return _ciExecutionId();
}

function _ciExecutionId() {
  if (process.env.NX_CI_EXECUTION_ID !== undefined) {
    return process.env.NX_CI_EXECUTION_ID;
  }

  // for backwards compat
  if (process.env.NX_RUN_GROUP !== undefined) {
    return process.env.NX_RUN_GROUP;
  }

  if (process.env.CIRCLECI !== undefined && process.env.CIRCLE_WORKFLOW_ID) {
    return process.env.CIRCLE_WORKFLOW_ID;
  }

  if (process.env.TRAVIS_BUILD_ID !== undefined) {
    return process.env.TRAVIS_BUILD_ID;
  }

  if (process.env.GITHUB_ACTIONS && process.env.GITHUB_RUN_ID) {
    return `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
  }

  if (process.env.BUILD_BUILDID) {
    return process.env.BUILD_BUILDID;
  }

  if (process.env.BITBUCKET_BUILD_NUMBER !== undefined) {
    return process.env.BITBUCKET_BUILD_NUMBER;
  }

  if (process.env.VERCEL_GIT_COMMIT_SHA !== undefined) {
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }

  if (process.env.CI_PIPELINE_ID) {
    return process.env.CI_PIPELINE_ID;
  }

  // Jenkins
  if (process.env.BUILD_TAG) {
    return process.env.BUILD_TAG;
  }
  return null;
}

export function getCIExecutionEnv() {
  if (isConnectedToPrivateCloud()) return undefined as any;
  return process.env.NX_CI_EXECUTION_ENV ?? '';
}

export function getRunGroup(): string {
  if (process.env.NX_RUN_GROUP !== undefined) {
    return process.env.NX_RUN_GROUP;
  }

  const ciExecutionId = _ciExecutionId();
  if (ciExecutionId) {
    if (getCIExecutionEnv()) {
      return `${ciExecutionId}-${getCIExecutionEnv()}`;
    } else {
      return ciExecutionId;
    }
  }

  return extractGitSha()!!;
}

export function getBranch(): string | null {
  if (process.env.NX_BRANCH !== undefined) {
    return process.env.NX_BRANCH;
  }

  if (process.env.CIRCLECI !== undefined) {
    if (process.env.CIRCLE_PR_NUMBER !== undefined) {
      return process.env.CIRCLE_PR_NUMBER;
    } else if (process.env.CIRCLE_PULL_REQUEST !== undefined) {
      const p = process.env.CIRCLE_PULL_REQUEST.split('/');
      return p[p.length - 1];
    } else if (process.env.CIRCLE_BRANCH !== undefined) {
      return process.env.CIRCLE_BRANCH;
    }
  }

  if (process.env.TRAVIS_PULL_REQUEST !== undefined) {
    return process.env.TRAVIS_PULL_REQUEST;
  }

  // refs/pull/78/merge
  if (process.env.GITHUB_ACTIONS) {
    if (process.env.GITHUB_REF) {
      const ref = process.env.GITHUB_REF.match(/refs\/pull\/(\d+)\/merge/);
      if (ref) {
        return ref[1];
      }
    }
    return process.env.GITHUB_HEAD_REF ?? '';
  }

  if (process.env.BITBUCKET_PR_ID !== undefined) {
    return process.env.BITBUCKET_PR_ID;
  }

  if (process.env.VERCEL_GIT_COMMIT_REF !== undefined) {
    return process.env.VERCEL_GIT_COMMIT_REF;
  }

  // Gitlab, merge request flow only
  // For support: Users must have their pipeline configured as merge requests
  // ONLY to have this variable appear.
  // https://docs.gitlab.com/ee/ci/pipelines/merge_request_pipelines.html#use-only-to-add-jobs
  if (process.env.CI_MERGE_REQUEST_IID) {
    return process.env.CI_MERGE_REQUEST_IID;
  }

  // Gitlab, branch pipeline flow only
  // Will not work with bot comments
  if (process.env.CI_COMMIT_BRANCH) {
    return process.env.CI_COMMIT_BRANCH;
  }

  // Jenkins, this will only be populated in MULTIBRANCH pipelines.
  // Remember that if someone asks in support :)
  if (process.env.GIT_BRANCH) {
    return process.env.GIT_BRANCH;
  }

  return null;
}

export function getMachineInfo(): MachineInfo {
  const os = require('os');

  const hasher = createHash('md5');
  hasher.update(machineIdSync());
  const machineId = hasher.digest('base64');

  return {
    machineId,
    platform: os.platform(),
    version: (os as any).version ? (os as any).version() : '',
    cpuCores: os.cpus().length,
  };
}

export function parseCommand() {
  const cmdBase = parse(process.argv[1]).name;
  const args = `${process.argv.slice(2).join(' ')}`;
  return `${cmdBase} ${args}`;
}
