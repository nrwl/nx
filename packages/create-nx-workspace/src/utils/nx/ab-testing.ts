import { execSync } from 'node:child_process';
import { isCI } from '../ci/is-ci';
import { getPackageManagerCommand } from '../package-manager';

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
      hint: `\n(can be disabled any time)`,
      fallback: undefined,
    },
  ],
  /**
   * Simplified Cloud prompt for template flow (no CI provider selection)
   */
  setupNxCloudSimple: [
    {
      code: 'simple-cloud-v1',
      metaCode: 'green-prs',
      message: 'Get to green PRs faster with Nx Cloud?',
      initial: 0,
      choices: [
        { value: 'yes', name: 'Yes, set up Nx Cloud' },
        { value: 'skip', name: 'Skip' },
      ],
      footer:
        '\nAutomated validation, self-healing tests, and 70% faster CI: https://nx.dev/docs/guides/nx-cloud/optimize-your-ttg',
      hint: `\n(free for open source)`,
      fallback: undefined,
    },
    {
      code: 'simple-cloud-v2',
      metaCode: 'remote-cache',
      message: 'Would you like to enable remote caching with Nx Cloud?',
      initial: 0,
      choices: [
        { value: 'yes', name: 'Yes, enable caching' },
        { value: 'skip', name: 'No, configure it later' },
      ],
      footer:
        '\nRemote caching makes your builds faster: https://nx.dev/ci/features/remote-cache',
      hint: `\n(can be enabled any time)`,
      fallback: undefined,
    },
    {
      code: 'simple-cloud-v3',
      metaCode: 'fast-ci',
      message: 'Speed up CI and reduce compute costs with Nx Cloud?',
      initial: 0,
      choices: [
        { value: 'yes', name: 'Yes' },
        { value: 'skip', name: 'Skip' },
      ],
      footer:
        '\n70% faster CI, 60% less compute, automated test healing: https://nx.dev/ci/features/remote-cache',
      hint: `\n(can be enabled later)`,
      fallback: undefined,
    },
  ],
};

export type MessageKey = keyof typeof messageOptions;
interface MessageData {
  code: string;
  metaCode?: string; // Optional short code for URL meta tracking
  message: string;
  initial: number;
  choices: Array<{ value: string; name: string }>;
  footer: string;
  hint?: string;
  fallback?: { value: string; key: MessageKey };
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
    } else {
      return messageOptions[key][selected].code;
    }
  }

  metaCodeOfSelectedPromptMessage(key: MessageKey): string {
    const selected = this.selectedMessages[key];
    if (selected === undefined) {
      return '';
    } else {
      const message = messageOptions[key][selected];
      return message.metaCode || message.code;
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
}) {
  try {
    if (!shouldRecordStats()) {
      return;
    }
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
  const pmc = getPackageManagerCommand();
  if (!pmc.getRegistryUrl) {
    // Fallback on true as Package management doesn't support reading config for registry.
    // currently Bun doesn't support fetching config settings https://github.com/oven-sh/bun/issues/7140
    return true;
  }
  try {
    const stdout = execSync(pmc.getRegistryUrl, {
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
