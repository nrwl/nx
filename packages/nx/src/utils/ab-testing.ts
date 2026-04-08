import { execSync } from 'node:child_process';
import { isCI } from './is-ci';
import { getPackageManagerCommand } from './package-manager';
import { getCloudUrl } from '../nx-cloud/utilities/get-cloud-options';
import * as pc from 'picocolors';

/**
 * Meta payload types for recordStat telemetry (matches CNW format).
 */
export interface RecordStatMetaStart {
  type: 'start';
  [key: string]: string | boolean;
}

export interface RecordStatMetaComplete {
  type: 'complete';
  [key: string]: string | boolean;
}

export interface RecordStatMetaError {
  type: 'error';
  errorCode: string;
  errorMessage: string;
  [key: string]: string | boolean;
}

export type RecordStatMeta =
  | RecordStatMetaStart
  | RecordStatMetaComplete
  | RecordStatMetaError;

export type MessageOptionKey = 'yes' | 'skip' | 'never';

interface MessageData {
  code: string;
  message: string;
  initial: number;
  choices: Array<{ value: string; name: string; hint?: string }>;
  footer: string;
  hint?: string;
}

const messageOptions: Record<string, MessageData[]> = {
  setupNxCloud: [
    {
      code: 'cloud-ab-remote-cache-speed',
      message: 'Enable remote caching to speed up builds with Nx Cloud?',
      initial: 0,
      choices: [
        { value: 'yes', name: 'Yes' },
        { value: 'skip', name: 'Skip for now' },
        { value: 'never', name: pc.dim("No, don't ask again") },
      ],
      footer:
        '\nFree for small teams. 2-minute setup with GitHub — cache locally and in CI: https://nx.dev/nx-cloud',
    },
  ],
  setupViewLogs: [
    {
      code: 'connect-to-view-logs',
      message: `To view the logs, Nx needs to connect your workspace to Nx Cloud and upload the most recent run details`,
      initial: 0,
      choices: [
        {
          value: 'yes',
          name: 'Yes',
          hint: 'Connect to Nx Cloud and upload the run details',
        },
        { value: 'skip', name: 'No' },
      ],
      footer: '\nRead more about Nx Cloud at https://nx.dev/nx-cloud',
      hint: `\n(it's free and can be disabled any time)`,
    },
  ],
};

export type MessageKey = keyof typeof messageOptions;

export class PromptMessages {
  private selectedMessages = {};

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
    return messageOptions[key][this.selectedMessages[key]];
  }

  codeOfSelectedPromptMessage(key: string): string {
    if (this.selectedMessages[key] === undefined) return null;
    return messageOptions[key][this.selectedMessages[key]].code;
  }
}

export const messages = new PromptMessages();

/**
 * We are incrementing a counter to track how often create-nx-workspace is used in CI
 * vs dev environments. No personal information is collected.
 */
export async function recordStat(opts: {
  command: string;
  nxVersion: string;
  useCloud: boolean;
  meta?: RecordStatMeta;
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
        meta: opts.meta
          ? JSON.stringify({ ...opts.meta, nxVersion: opts.nxVersion })
          : opts.nxVersion,
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
      windowsHide: true,
    });
    const url = new URL(stdout.trim());

    // don't record stats when testing locally
    return url.hostname !== 'localhost';
  } catch {
    // fallback to true if we can't detect the registry
    return true;
  }
}
