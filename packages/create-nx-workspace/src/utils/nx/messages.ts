import { VcsPushStatus } from '../git/git';

function getSetupMessage(
  url: string | null,
  pushedToVcs: VcsPushStatus,
  workspaceName?: string,
  isPromo?: boolean
): string {
  const githubUrl = workspaceName
    ? `https://github.com/new?name=${encodeURIComponent(workspaceName)}`
    : 'https://github.com/new';

  if (isPromo) {
    if (pushedToVcs === VcsPushStatus.PushedToVcs) {
      return url
        ? `Connect your repo to enable remote caching and self-healing CI at: ${url}`
        : 'Connect your repo at https://cloud.nx.app to enable remote caching and self-healing CI.';
    }

    return url
      ? `Connect your repo (${githubUrl}) to enable remote caching and self-healing CI at: ${url}`
      : `Connect your repo (${githubUrl}) to enable remote caching and self-healing CI at https://cloud.nx.app`;
  }

  if (pushedToVcs === VcsPushStatus.PushedToVcs) {
    return url
      ? `Go to Nx Cloud and finish the setup: ${url}`
      : 'Return to Nx Cloud and finish the setup.';
  }

  // User needs to push first
  const action = url ? 'go' : 'return';
  const urlSuffix = url ? `: ${url}` : '.';
  return `Push your repo (${githubUrl}), then ${action} to Nx Cloud and finish the setup${urlSuffix}`;
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
  'platform-promo': {
    title: 'Want faster builds?',
    subtext: 'Remote caching \u00b7 Self-healing CI \u00b7 Task distribution',
  },
} as const;

export type CompletionMessageKey = keyof typeof completionMessages;

export function getCompletionMessage(
  completionMessageKey: CompletionMessageKey | undefined,
  url: string | null,
  pushedToVcs: VcsPushStatus,
  workspaceName?: string
): { title: string; bodyLines: string[] } {
  const key = completionMessageKey ?? 'ci-setup';
  const messageConfig = completionMessages[key];
  const isPromo = key === 'platform-promo';

  const bodyLines = [getSetupMessage(url, pushedToVcs, workspaceName, isPromo)];

  if ('subtext' in messageConfig && messageConfig.subtext) {
    bodyLines.push('');
    bodyLines.push(messageConfig.subtext);
  }

  return {
    title: messageConfig.title,
    bodyLines,
  };
}

export function getSkippedCloudMessage(): {
  title: string;
  bodyLines: string[];
} {
  return {
    title: 'Next steps',
    bodyLines: [
      'Run "nx connect" to enable remote caching and speed up your CI.',
      '',
      '70% faster CI, 60% less compute, automatically fix broken PRs.',
      'Learn more at https://nx.dev/nx-cloud',
    ],
  };
}
