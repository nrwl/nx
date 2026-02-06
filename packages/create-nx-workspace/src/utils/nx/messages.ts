import { VcsPushStatus } from '../git/git';

/**
 * Banner variants for the completion message experiment (CLOUD-4235).
 * - '0': Plain link (control) - always used for enterprise URLs
 * - '1': "Finish your set up in 5 minutes" decorative banner
 * - '2': "Enable remote caching and automatic fixes when CI fails" decorative banner
 */
export type BannerVariant = '0' | '1' | '2';

/**
 * Generates the decorative ASCII art banner for Nx Cloud.
 * Line widths are carefully calculated to align properly.
 */
function generateDecorativeBanner(
  headline: string,
  url: string,
  subtext: string
): string[] {
  // Fixed banner structure - pad content to fit within the box
  // Total inner width is 60 characters
  const innerWidth = 60;

  const padCenter = (text: string, width: number): string => {
    const padding = width - text.length;
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  };

  const line1 = padCenter('', innerWidth);
  const line2 = padCenter(`- ${headline} -`, innerWidth);
  const line3 = padCenter(url, innerWidth);
  const line4 = padCenter(subtext, innerWidth);

  return [
    ` ${'_'.repeat(innerWidth + 1)}  ____   ___   __   `,
    ` \\${line1}\\ \\   \\  \\  \\  \\ \\`,
    `  \\${line2}\\ \\   \\  \\  \\  \\ \\`,
    `   \\${line3}\\ \\   \\  \\  \\  \\ \\`,
    `    \\${line4}\\ \\   \\  \\  \\  \\ \\ `,
    `     \\${'_'.repeat(innerWidth)}\\ \\___\\  \\__\\  \\_\\`,
  ];
}

/**
 * Get banner lines based on the variant.
 * Returns empty array for variant 0 (plain link).
 */
function getBannerLines(variant: BannerVariant, url: string): string[] {
  switch (variant) {
    case '1':
      return generateDecorativeBanner(
        'Finish your set up in 5 minutes ->',
        url,
        'Remote caching * Automatically fix CI failures'
      );
    case '2':
      return generateDecorativeBanner(
        'Enable remote caching and automatic fixes when CI fails',
        url,
        'Set it up in less than 5 minutes'
      );
    default:
      return [];
  }
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

  // Variants 1 and 2 use an updated title (CLOUD-4235)
  const title =
    variant === '1' || variant === '2'
      ? 'Nx Cloud configuration was successfully added.'
      : messageConfig.title;

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
