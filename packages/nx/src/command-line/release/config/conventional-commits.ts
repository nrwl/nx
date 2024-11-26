import { NxReleaseConfig } from './config';

export const DEFAULT_CONVENTIONAL_COMMITS_CONFIG: NxReleaseConfig['conventionalCommits'] =
  {
    types: {
      feat: {
        semverBump: 'minor',
        changelog: {
          title: '🚀 Features',
          hidden: false,
        },
      },
      fix: {
        semverBump: 'patch',
        changelog: {
          title: '🩹 Fixes',
          hidden: false,
        },
      },
      perf: {
        semverBump: 'none',
        changelog: {
          title: '🔥 Performance',
          hidden: false,
        },
      },
      refactor: {
        semverBump: 'none',
        changelog: {
          title: '💅 Refactors',
          hidden: true,
        },
      },
      docs: {
        semverBump: 'none',
        changelog: {
          title: '📖 Documentation',
          hidden: true,
        },
      },
      build: {
        semverBump: 'none',
        changelog: {
          title: '📦 Build',
          hidden: true,
        },
      },
      types: {
        semverBump: 'none',
        changelog: {
          title: '🌊 Types',
          hidden: true,
        },
      },
      chore: {
        semverBump: 'none',
        changelog: {
          title: '🏡 Chore',
          hidden: true,
        },
      },
      examples: {
        semverBump: 'none',
        changelog: {
          title: '🏀 Examples',
          hidden: true,
        },
      },
      test: {
        semverBump: 'none',
        changelog: {
          title: '✅ Tests',
          hidden: true,
        },
      },
      style: {
        semverBump: 'none',
        changelog: {
          title: '🎨 Styles',
          hidden: true,
        },
      },
      ci: {
        semverBump: 'none',
        changelog: {
          title: '🤖 CI',
          hidden: true,
        },
      },
      revert: {
        semverBump: 'none',
        changelog: {
          title: '⏪ Revert',
          hidden: true,
        },
      },
    },
  };
