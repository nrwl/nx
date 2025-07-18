import { VcsPushStatus } from '../git/git';

function getSetupMessage(
  url: string | null,
  pushedToVcs: VcsPushStatus
): string {
  if (pushedToVcs === VcsPushStatus.PushedToVcs) {
    return url
      ? `Go to Nx Cloud and finish the setup: ${url}`
      : 'Return to Nx Cloud and finish the setup';
  }

  // Default case: FailedToPushToVcs
  const action = url ? 'go' : 'return';
  const urlSuffix = url ? `: ${url}` : '';
  return `Push your repo, then ${action} to Nx Cloud and finish the setup${urlSuffix}`;
}

const outputMessages = {
  'create-nx-workspace-success-ci-setup': [
    {
      code: 'ci-setup-visit',
      createMessage: (url: string | null, pushedToVcs: VcsPushStatus) => {
        return {
          title: `Your CI setup is almost complete.`,
          type: 'success',
          bodyLines: [getSetupMessage(url, pushedToVcs)],
        };
      },
    },
  ],
  'create-nx-workspace-success-cache-setup': [
    {
      code: 'remote-cache-visit',
      createMessage: (url: string | null, pushedToVcs: VcsPushStatus) => {
        return {
          title: `Your remote cache is almost complete.`,
          type: 'success',
          bodyLines: [
            getSetupMessage(url, pushedToVcs),
            `You can also set up a remote cache later by running \`nx g @nx/nx-cloud:init\``,
          ],
        };
      },
    },
  ],
} as const;
type OutputMessageKey = keyof typeof outputMessages;

class ABTestingMessages {
  private selectedMessages: Record<string, number> = {};
  getMessageFactory(key: OutputMessageKey) {
    if (this.selectedMessages[key] === undefined) {
      if (process.env.NX_GENERATE_DOCS_PROCESS === 'true') {
        this.selectedMessages[key] = 0;
      } else {
        this.selectedMessages[key] = Math.floor(
          Math.random() * outputMessages[key].length
        );
      }
    }
    return outputMessages[key][this.selectedMessages[key]!];
  }
}

const messages = new ABTestingMessages();

export function getMessageFactory(key: OutputMessageKey) {
  return messages.getMessageFactory(key);
}
