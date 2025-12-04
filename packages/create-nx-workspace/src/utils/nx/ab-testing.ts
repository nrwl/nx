import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isCI } from '../ci/is-ci';
import type { CompletionMessageKey } from './messages';

// TODO(jack): Remove flow variant logic after A/B testing is complete
const FLOW_VARIANT_CACHE_FILE = join(tmpdir(), 'nx-cnw-flow-variant');
const FLOW_VARIANT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

// In-memory cache to ensure consistency within a single run
let flowVariantCache: string | null = null;

function readCachedFlowVariant(): string | null {
  try {
    if (!existsSync(FLOW_VARIANT_CACHE_FILE)) return null;
    const stats = statSync(FLOW_VARIANT_CACHE_FILE);
    if (Date.now() - stats.mtimeMs > FLOW_VARIANT_EXPIRY_MS) return null;
    const value = readFileSync(FLOW_VARIANT_CACHE_FILE, 'utf-8').trim();
    return value === '0' || value === '1' ? value : null;
  } catch {
    return null;
  }
}

function writeCachedFlowVariant(variant: string): void {
  try {
    writeFileSync(FLOW_VARIANT_CACHE_FILE, variant, 'utf-8');
  } catch {
    // Ignore write errors
  }
}

/**
 * Internal function to determine and cache the flow variant.
 */
function getFlowVariantInternal(): string {
  if (flowVariantCache) return flowVariantCache;

  const variant =
    process.env.NX_CNW_FLOW_VARIANT ??
    readCachedFlowVariant() ??
    (Math.random() < 0.5 ? '0' : '1');

  flowVariantCache = variant;

  // Only write to cache if we randomly assigned a variant and no cache exists yet
  // This ensures the cache expiry is based on original creation time, not last access
  if (
    !process.env.NX_CNW_FLOW_VARIANT &&
    !existsSync(FLOW_VARIANT_CACHE_FILE)
  ) {
    writeCachedFlowVariant(variant);
  }

  return variant;
}

/**
 * Determines whether to use the new template flow (1) or old preset flow (0).
 * - NX_CNW_FLOW_VARIANT=0 forces preset flow
 * - NX_CNW_FLOW_VARIANT=1 forces template flow
 * - NX_GENERATE_DOCS_PROCESS=true forces preset flow (for docs generation)
 * - Otherwise, uses cached value (7 days) or randomly assigns
 */
export function shouldUseTemplateFlow(): boolean {
  if (process.env.NX_GENERATE_DOCS_PROCESS === 'true') {
    flowVariantCache = '0';
    return false;
  }

  return getFlowVariantInternal() === '1';
}

/**
 * Returns the flow variant for tracking (0 = preset, 1 = template).
 */
export function getFlowVariant(): string {
  if (process.env.NX_GENERATE_DOCS_PROCESS === 'true') {
    return '0';
  }
  return flowVariantCache ?? getFlowVariantInternal();
}

export const NxCloudChoices = [
  'github',
  'gitlab',
  'azure',
  'bitbucket-pipelines',
  'circleci',
  'skip',
  'yes', // Deprecated but still handled
];

const messageOptions: Record<string, MessageData[]> = {
  /**
   * These messages are for setting up CI as part of create-nx-workspace and nx init
   */
  setupCI: [
    {
      code: 'which-ci-provider',
      message: `Which CI provider would you like to use?`,
      initial: 0,
      choices: [
        { value: 'github', name: 'GitHub Actions' },
        { value: 'gitlab', name: 'Gitlab' },
        { value: 'azure', name: 'Azure DevOps' },
        { value: 'bitbucket-pipelines', name: 'BitBucket Pipelines' },
        { value: 'circleci', name: 'Circle CI' },
        { value: 'skip', name: '\nDo it later' },
      ],
      footer:
        '\nSelf-healing CI, remote caching, and task distribution are provided by Nx Cloud: https://nx.dev/nx-cloud',
      fallback: { value: 'skip', key: 'setupNxCloud' },
      completionMessage: 'ci-setup',
    },
  ],
  /**
   * These messages are a fallback for setting up CI as well as when migrating major versions
   */
  setupNxCloud: [
    {
      code: 'enable-caching2',
      message: `Would you like remote caching to make your build faster?`,
      initial: 0,
      choices: [
        { value: 'yes', name: 'Yes' },
        {
          value: 'skip',
          name: 'No - I would not like remote caching',
        },
      ],
      footer:
        '\nRead more about remote caching at https://nx.dev/ci/features/remote-cache',
      hint: `\n(can be disabled any time).`,
      fallback: undefined,
      completionMessage: 'cache-setup',
    },
  ],
  /**
   * Simplified Cloud prompt for template flow
   */
  setupNxCloudV2: [
    {
      code: 'cloud-v2-remote-cache-visit',
      message: 'Enable remote caching with Nx Cloud?',
      initial: 0,
      choices: [
        { value: 'yes', name: 'Yes' },
        { value: 'skip', name: 'Skip' },
      ],
      footer:
        '\nRemote caching makes your builds faster for development and in CI: https://nx.dev/ci/features/remote-cache',
      fallback: undefined,
      completionMessage: 'cache-setup',
    },
    {
      code: 'cloud-v2-fast-ci-visit',
      message: 'Speed up CI and reduce compute costs with Nx Cloud?',
      initial: 0,
      choices: [
        { value: 'yes', name: 'Yes' },
        { value: 'skip', name: 'Skip' },
      ],
      footer:
        '\n70% faster CI, 60% less compute, Automatically fix broken PRs: https://nx.dev/nx-cloud',
      fallback: undefined,
      completionMessage: 'ci-setup',
    },
    {
      code: 'cloud-v2-green-prs-visit',
      message: 'Get to green PRs faster with Nx Cloud?',
      initial: 0,
      choices: [
        { value: 'yes', name: 'Yes' },
        { value: 'skip', name: 'Skip' },
      ],
      footer:
        '\nAutomatically fix broken PRs, 70% faster CI: https://nx.dev/nx-cloud',
      fallback: undefined,
      completionMessage: 'ci-setup',
    },
    {
      code: 'cloud-v2-full-platform-visit',
      message: 'Try the full Nx platform?',
      initial: 0,
      choices: [
        { value: 'yes', name: 'Yes' },
        { value: 'skip', name: 'Skip' },
      ],
      footer:
        '\nAutomatically fix broken PRs, 70% faster CI: https://nx.dev/nx-cloud',
      fallback: undefined,
      completionMessage: 'platform-setup',
    },
  ],
};

export type MessageKey = keyof typeof messageOptions;
interface MessageData {
  code: string;
  message: string;
  initial: number;
  choices: Array<{ value: string; name: string }>;
  footer: string;
  hint?: string;
  fallback?: { value: string; key: MessageKey };
  completionMessage: CompletionMessageKey;
}

export class PromptMessages {
  private selectedMessages: { [key in MessageKey]?: number } = {};

  getPrompt(key: MessageKey): MessageData {
    if (this.selectedMessages[key] === undefined) {
      if (process.env.NX_GENERATE_DOCS_PROCESS === 'true') {
        this.selectedMessages[key] = 0;
      } else {
        this.selectedMessages[key] = Math.floor(
          Math.random() * messageOptions[key].length
        );
      }
    }
    return messageOptions[key][this.selectedMessages[key]!];
  }

  codeOfSelectedPromptMessage(key: MessageKey): string {
    const selected = this.selectedMessages[key];
    if (selected === undefined) {
      return '';
    }
    return messageOptions[key][selected].code;
  }

  completionMessageOfSelectedPrompt(key: MessageKey): CompletionMessageKey {
    const selected = this.selectedMessages[key];
    if (selected === undefined) {
      return 'ci-setup';
    } else {
      return messageOptions[key][selected].completionMessage;
    }
  }
}

export const messages = new PromptMessages();

function getCloudUrl(): string {
  const url =
    process.env.NX_CLOUD_API || process.env.NRWL_API || 'https://cloud.nx.app';
  // Remove trailing slash if present
  return url[url.length - 1] === '/' ? url.slice(0, -1) : url;
}

/**
 * We are incrementing a counter to track how often create-nx-workspace is used in CI
 * vs dev environments. No personal information is collected.
 */
export async function recordStat(opts: {
  command: string;
  nxVersion: string;
  useCloud: boolean;
  meta: string[];
  directory: string;
}) {
  try {
    if (!shouldRecordStats()) {
      return;
    }

    // nx-ignore-next-line
    const { getCloudUrl } = require(require.resolve(
      'nx/src/nx-cloud/utilities/get-cloud-options',
      {
        paths: [opts.directory],
      }
      // nx-ignore-next-line
    )) as typeof import('nx/src/nx-cloud/utilities/get-cloud-options');

    const axios = require('axios');
    await (axios['default'] ?? axios)
      .create({
        baseURL: getCloudUrl(),
        timeout: 400,
      })
      .post('/nx-cloud/stats', {
        command: opts.command,
        isCI: isCI(),
        useCloud: opts.useCloud,
        meta: [opts.nxVersion, ...opts.meta].filter((v) => !!v).join(','),
      });
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(e);
    }
  }
}

function shouldRecordStats(): boolean {
  try {
    // Use npm to check registry - this works regardless of which package manager invoked us
    const stdout = execSync('npm config get registry', {
      encoding: 'utf-8',
      windowsHide: false,
    });
    const url = new URL(stdout.trim());

    // don't record stats when testing locally
    return url.hostname !== 'localhost';
  } catch {
    // fallback to true if we can't detect the registry
    return true;
  }
}
