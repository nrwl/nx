import { isCI } from './is-ci';

export type MessageOptionKey = 'yes' | 'skip';

const messageOptions = {
  setupNxCloud: [
    {
      code: 'enable-caching',
      message: `Would you like remote caching to make your build faster?`,
      initial: 0,
      choices: [
        { value: 'yes', name: 'Yes' },
        { value: 'skip', name: 'Skip for now' },
      ],
      footer:
        '\nRead more about remote cache at https://nx.dev/ci/features/remote-cache',
      hint: `\n(it's free and can be disabled any time)`,
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
      footer:
        '\nRead more about remote cache at https://nx.dev/ci/features/remote-cache',
      hint: `\n(it's free and can be disabled any time)`,
    },
  ],
} as const;

export type MessageKey = keyof typeof messageOptions;
export type MessageData = typeof messageOptions[MessageKey][number];

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
  meta: string;
}) {
  try {
    const major = Number(opts.nxVersion.split('.')[0]);
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log(`Record stat. Major: ${major}`);
    }
    if (major < 10 || major > 16) return; // test version, skip it
    const axios = require('axios');
    await (axios['default'] ?? axios)
      .create({
        baseURL: 'https://cloud.nx.app',
        timeout: 400,
      })
      .post('/nx-cloud/stats', {
        command: opts.command,
        isCI: isCI(),
        useCloud: opts.useCloud,
        meta: opts.meta,
      });
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(e);
    }
  }
}
