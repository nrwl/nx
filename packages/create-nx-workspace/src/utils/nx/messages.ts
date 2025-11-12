import { VcsPushStatus } from '../git/git';

function getSetupMessage(
  url: string | null,
  pushedToVcs: VcsPushStatus
): string {
  if (pushedToVcs === VcsPushStatus.PushedToVcs) {
    return url
      ? `Go to Nx Cloud and finish the setup: ${url}`
      : 'Return to Nx Cloud and finish the setup.';
  }

  // Default case: FailedToPushToVcs
  const action = url ? 'go' : 'return';
  const urlSuffix = url ? `: ${url}` : '.';
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
          bodyLines: [getSetupMessage(url, pushedToVcs)],
        };
      },
    },
  ],
  'create-nx-workspace-template-cloud': [
    {
      code: 'template-cloud-connect-v1',
      createMessage: (url: string | null, pushedToVcs: VcsPushStatus) => ({
        title: 'Connect to Nx Cloud to complete setup',
        type: 'success',
        bodyLines: [
          url || 'Run: nx connect',
          '',
          'Nx Cloud provides:',
          '  • Remote caching across your team',
          '  • Distributed task execution',
          '  • Real-time build insights',
        ],
      }),
    },
    {
      code: 'template-cloud-connect-v2',
      createMessage: (url: string | null, pushedToVcs: VcsPushStatus) => ({
        title: 'One more step: activate remote caching',
        type: 'success',
        bodyLines: [
          'Visit the link below to connect your workspace:',
          url || '',
          '',
          'This enables 10x faster builds by sharing cache across your team.',
        ],
      }),
    },
    {
      code: 'template-cloud-connect-v3',
      createMessage: (url: string | null, pushedToVcs: VcsPushStatus) => ({
        title: 'Almost done! Finish Nx Cloud setup',
        type: 'success',
        bodyLines: [
          url || 'Run: nx connect',
          '',
          'Takes 30 seconds. Makes your builds 10x faster.',
        ],
      }),
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
