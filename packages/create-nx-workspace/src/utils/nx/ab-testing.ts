import { isCI } from '../ci/is-ci';

const messageOptions = {
  nxCloudCreation: [
    {
      code: 'set-up-distributed-caching-ci',
      message: `Enable distributed caching to make your CI faster`,
    },
  ],
  nxCloudMigration: [
    {
      code: 'make-ci-faster',
      message: `Enable distributed caching to make your CI faster?`,
    },
  ],
} as const;

type MessageKey = keyof typeof messageOptions;

export class PromptMessages {
  private selectedMessages: { [key in MessageKey]?: number } = {};

  getPromptMessage(key: MessageKey): string {
    if (this.selectedMessages[key] === undefined) {
      if (process.env.NX_GENERATE_DOCS_PROCESS === 'true') {
        this.selectedMessages[key] = 0;
      } else {
        this.selectedMessages[key] = Math.floor(
          Math.random() * messageOptions[key].length
        );
      }
    }
    return messageOptions[key][this.selectedMessages[key]!].message;
  }

  codeOfSelectedPromptMessage(key: MessageKey): string {
    const selected = this.selectedMessages[key];
    if (selected === undefined) {
      return messageOptions[key][0].code;
    } else {
      return messageOptions[key][selected].code;
    }
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
    if (major < 10 || major > 15) return; // test version, skip it
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
