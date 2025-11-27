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

/**
 * Completion messages shown after workspace creation.
 * Keys are referenced by ab-testing.ts prompts via completionMessage field.
 */
const completionMessages = {
  'ci-setup': {
    title: 'Your CI setup is almost complete.',
  },
  'cache-setup': {
    title: 'Your remote cache setup is almost complete.',
  },
  'platform-setup': {
    title: 'Your platform setup is almost complete.',
  },
} as const;

export type CompletionMessageKey = keyof typeof completionMessages;

export function getCompletionMessage(
  completionMessageKey: CompletionMessageKey | undefined,
  url: string | null,
  pushedToVcs: VcsPushStatus
): { title: string; type: 'success'; bodyLines: string[] } {
  const key = completionMessageKey ?? 'ci-setup';

  return {
    title: completionMessages[key].title,
    type: 'success',
    bodyLines: [getSetupMessage(url, pushedToVcs)],
  };
}

export function getSkippedCloudMessage(): {
  title: string;
  type: 'success';
  bodyLines: string[];
} {
  return {
    title: 'Next steps',
    type: 'success',
    bodyLines: [
      'Run "nx connect" to enable remote caching and speed up your CI.',
      '',
      '70% faster CI, 60% less compute, automatically fix broken PRs.',
      'Learn more at https://nx.dev/nx-cloud',
    ],
  };
}
