const outputMessages = {
  'create-nx-workspace-success-ci-setup': [
    {
      code: 'ci-setup-visit',
      createMessage: (url: string) => ({
        title: `Your CI setup is almost complete.`,
        type: 'success',
        bodyLines: [`Finish it by visiting: ${url}`],
      }),
    },
  ],
  'create-nx-workspace-success-cache-setup': [
    {
      code: 'remote-cache-visit',
      createMessage: (url: string) => ({
        title: `Your remote cache setup is almost complete.`,
        type: 'success',
        bodyLines: [`Finish it by visiting: ${url}`],
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
