import axios from 'axios';
import { isCI } from './is-ci';

export class PromptMessages {
  private messages = {
    nxCloudCreation: [
      {
        code: 'set-up-distributed-caching-ci',
        message: `Enable distributed caching to make your CI faster`,
      },
    ],
    nxCloudMigration: [
      {
        code: 'we-noticed',
        message: `We noticed you are migrating to a new major version, but are not taking advantage of Nx Cloud. Nx Cloud can make your CI up to 10 times faster. Learn more about it here: nx.app. Would you like to add it?`,
      },
      {
        code: 'not-leveraging-caching',
        message: `You're not leveraging distributed caching yet. Do you want to enable it and speed up your CI?`,
      },
      {
        code: 'make-ci-faster',
        message: `Enable distributed caching to make your CI faster?`,
      },
    ],
  };

  private selectedMessages = {};

  getPromptMessage(key: string): string {
    if (this.selectedMessages[key] === undefined) {
      if (process.env.NX_GENERATE_DOCS_PROCESS === 'true') {
        this.selectedMessages[key] = 0;
      } else {
        this.selectedMessages[key] = Math.floor(
          Math.random() * this.messages[key].length
        );
      }
    }
    return this.messages[key][this.selectedMessages[key]].message;
  }

  codeOfSelectedPromptMessage(key: string): string {
    if (this.selectedMessages[key] === undefined) return null;
    return this.messages[key][this.selectedMessages[key]].code;
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
    if (major < 10 || major > 14) return; // test version, skip it
    await axios
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
