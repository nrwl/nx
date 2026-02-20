import { VcsPushStatus } from '../git/git';

/**
 * Banner variants for the completion message (CLOUD-4255).
 * - '0': Plain link - used for enterprise URLs and docs generation
 * - '2': Simple box banner with setup URL
 */
export type BannerVariant = '0' | '2';

/**
 * Generates a simple box banner with the setup URL.
 */
function generateSimpleBanner(url: string): string[] {
  const content = `Finish your set up here: ${url}`;
  // Add padding around content (3 spaces on each side)
  const innerWidth = content.length + 6;
  const horizontalBorder = '+' + '-'.repeat(innerWidth) + '+';
  const emptyLine = '|' + ' '.repeat(innerWidth) + '|';
  const contentLine = '|   ' + content + '   |';

  return [
    horizontalBorder,
    emptyLine,
    contentLine,
    emptyLine,
    horizontalBorder,
  ];
}

/**
 * Get banner lines based on the variant.
 * Returns empty array for variant 0 (plain link).
 */
function getBannerLines(variant: BannerVariant, url: string): string[] {
  if (variant === '2') {
    return generateSimpleBanner(url);
  }
  // Variant 0: plain link (no banner)
  return [];
}

function getSetupMessage(
  url: string | null,
  pushedToVcs: VcsPushStatus,
  workspaceName?: string
): string {
  const githubUrl = workspaceName
    ? `https://github.com/new?name=${encodeURIComponent(workspaceName)}`
    : 'https://github.com/new';

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
} as const;

export type CompletionMessageKey = keyof typeof completionMessages;

export function getCompletionMessage(
  completionMessageKey: CompletionMessageKey | undefined,
  url: string | null,
  pushedToVcs: VcsPushStatus,
  workspaceName?: string,
  bannerVariant?: BannerVariant
): { title: string; bodyLines: string[] } {
  const key = completionMessageKey ?? 'ci-setup';
  const messageConfig = completionMessages[key];
  const variant = bannerVariant ?? '0';

  // Variant 2: No title since nothing was configured yet (deferred connection)
  // The banner with the connect URL is sufficient
  const title = variant === '2' ? '' : messageConfig.title;

  // For decorative banner variants (1, 2), show the banner instead of plain text
  if (variant !== '0' && url) {
    const bannerLines = getBannerLines(variant, url);
    if (bannerLines.length > 0) {
      return {
        title,
        bodyLines: [...bannerLines, ''],
      };
    }
  }

  // Variant 0 (control) or fallback: plain link message
  const bodyLines = [getSetupMessage(url, pushedToVcs, workspaceName)];

  return {
    title,
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
