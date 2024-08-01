const outputMessages = {
  'create-nx-workspace-success-ci-setup': [
    {
      code: 'nx-cloud-workspace-push-goto',
      createMessage: (url: string) => ({
        title: `Your Nx Cloud workspace is ready.`,
        type: 'success',
        bodyLines: [
          `To claim it, connect it to your Nx Cloud account:`,
          `- Push your repository to your git hosting provider.`,
          `- Go to the following URL to connect your workspace to Nx Cloud:`,
          '',
          `${url}`,
        ],
      }),
    },
    {
      code: 'nx-cloud-powered-ci-setup-visit',
      createMessage: (url: string) => ({
        title: `Your CI setup powered by Nx Cloud is almost complete.`,
        type: 'success',
        bodyLines: [`Finish it by visiting: ${url}`],
      }),
    },
    {
      code: 'nx-cloud-powered-ci-setup-connect',
      createMessage: (url: string) => ({
        title: `Your CI setup powered by Nx Cloud is almost complete.`,
        type: 'success',
        bodyLines: [`Connect your repository: ${url}`],
      }),
    },
    {
      code: 'ci-setup-visit',
      createMessage: (url: string) => ({
        title: `Your CI setup is almost complete.`,
        type: 'success',
        bodyLines: [`Finish it by visiting: ${url}`],
      }),
    },
    {
      code: 'ci-setup-connect',
      createMessage: (url: string) => ({
        title: `Your CI setup is almost complete.`,
        type: 'success',
        bodyLines: [`Connect your repository: ${url}`],
      }),
    },
    {
      code: 'nx-cloud-powered-ci-setup-visit-warn',
      createMessage: (url: string) => ({
        title: `Your CI setup powered by Nx Cloud is almost complete.`,
        type: 'warning',
        bodyLines: [`Finish it by visiting: ${url}`],
      }),
    },
    {
      code: 'nx-cloud-powered-ci-setup-connect-warn',
      createMessage: (url: string) => ({
        title: `Your CI setup powered by Nx Cloud is almost complete.`,
        type: 'warning',
        bodyLines: [`Connect your repository: ${url}`],
      }),
    },
    {
      code: 'ci-setup-visit-warn',
      createMessage: (url: string) => ({
        title: `Your CI setup is almost complete.`,
        type: 'warning',
        bodyLines: [`Finish it by visiting: ${url}`],
      }),
    },
    {
      code: 'ci-setup-connect-warn',
      createMessage: (url: string) => ({
        title: `Your CI setup is almost complete.`,
        type: 'warning',
        bodyLines: [`Connect your repository: ${url}`],
      }),
    },
  ],
  'create-nx-workspace-success-cache-setup': [
    {
      code: 'nx-cloud-workspace-push-goto',
      createMessage: (url: string) => ({
        title: `Your Nx Cloud workspace is ready.`,
        type: 'success',
        bodyLines: [
          `To claim it, connect it to your Nx Cloud account:`,
          `- Push your repository to your git hosting provider.`,
          `- Go to the following URL to connect your workspace to Nx Cloud:`,
          '',
          `${url}`,
        ],
      }),
    },
    {
      code: 'nx-cloud-remote-cache-setup-finish',
      createMessage: (url: string) => ({
        title: `Your Nx Cloud remote cache setup is almost complete.`,
        type: 'success',
        bodyLines: [`Finish it by visiting: ${url}`],
      }),
    },
    {
      code: 'nx-cloud-remote-cache-setup-connect',
      createMessage: (url: string) => ({
        title: `Your Nx Cloud remote cache setup is almost complete.`,
        type: 'success',
        bodyLines: [`Connect your repository: ${url}`],
      }),
    },
    {
      code: 'remote-cache-visit',
      createMessage: (url: string) => ({
        title: `Your remote cache setup is almost complete.`,
        type: 'success',
        bodyLines: [`Finish it by visiting: ${url}`],
      }),
    },
    {
      code: 'remote-cache-connect',
      createMessage: (url: string) => ({
        title: `Your remote cache setup is almost complete.`,
        type: 'success',
        bodyLines: [`Connect your repository: ${url}`],
      }),
    },
    {
      code: 'nx-cloud-remote-cache-setup-visit-warn',
      createMessage: (url: string) => ({
        title: `Your Nx Cloud remote cache setup is almost complete.`,
        type: 'warning',
        bodyLines: [`Finish it by visiting: ${url}`],
      }),
    },
    {
      code: 'nx-cloud-remote-cache-setup-connect-warn',
      createMessage: (url: string) => ({
        title: `Your Nx Cloud remote cache setup is almost complete.`,
        type: 'warning',
        bodyLines: [`Connect your repository: ${url}`],
      }),
    },
    {
      code: 'remote-cache-visit-warn',
      createMessage: (url: string) => ({
        title: `Your remote cache setup is almost complete.`,
        type: 'warning',
        bodyLines: [`Finish it by visiting: ${url}`],
      }),
    },
    {
      code: 'remote-cache-connect-warn',
      createMessage: (url: string) => ({
        title: `Your remote cache setup is almost complete.`,
        type: 'warning',
        bodyLines: [`Connect your repository: ${url}`],
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
