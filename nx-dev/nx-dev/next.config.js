// nx-ignore-next-line
const { withNx } = require('@nx/next/plugins/with-nx');
const redirectRules = require('./redirect-rules');

module.exports = withNx({
  // For both client and server
  env: {
    VERCEL: process.env.VERCEL,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
  async redirects() {
    const rules = [];

    // Tutorials
    for (let s of Object.keys(redirectRules.tutorialRedirects)) {
      rules.push({
        source: s,
        destination: redirectRules.tutorialRedirects[s],
        permanent: true,
      });
    }

    // Storybook
    rules.push({
      source: '/(l|latest)/(r|react)/storybook/overview',
      destination: '/storybook/overview-react',
      permanent: true,
    });
    rules.push({
      source: '/(l|latest)/(a|angular)/storybook/overview',
      destination: '/storybook/overview-angular',
      permanent: true,
    });
    rules.push({
      source: '/(l|latest)/(a|angular|r|react)/storybook/executors',
      destination: '/storybook/executors-storybook',
      permanent: true,
    });

    // Nx Console
    rules.push({
      source: '/nx-console',
      destination: '/using-nx/console',
      permanent: true,
    });
    rules.push({
      source: '/(l|latest)/(a|angular)/storybook/overview',
      destination: '/storybook/overview-angular',
      permanent: true,
    });
    rules.push({
      source: '/(l|latest)/(a|angular|r|react)/storybook/executors',
      destination: '/storybook/executors-storybook',
      permanent: true,
    });

    // Customs
    for (let s of Object.keys(redirectRules.guideUrls)) {
      rules.push({
        source: `/l/n${s}`,
        destination: redirectRules.guideUrls[s],
        permanent: true,
      });

      rules.push({
        source: `/l/r${s}`,
        destination: redirectRules.guideUrls[s],
        permanent: true,
      });

      rules.push({
        source: `/l/a${s}`,
        destination: redirectRules.guideUrls[s],
        permanent: true,
      });

      rules.push({
        source: s,
        destination: redirectRules.guideUrls[s],
        permanent: true,
      });
    }

    // Generic, catch-all
    rules.push({
      source: '/(l|latest|p|previous)/(a|angular|r|react|n|node)/:path*',
      destination: '/:path*',
      permanent: true,
    });
    rules.push({
      source: '/(l|latest|p|previous)/:path*',
      destination: '/:path*',
      permanent: true,
    });
    rules.push({
      source: '/(a|angular|r|react|n|node)/:path*',
      destination: '/:path*',
      permanent: true,
    });

    // Schemas (generators & executors)
    for (let s of Object.keys(redirectRules.schemaUrls)) {
      rules.push({
        source: s,
        destination: redirectRules.schemaUrls[s],
        permanent: true,
      });
    }

    // Api overviews
    for (let s of Object.keys(redirectRules.overviewUrls)) {
      rules.push({
        source: s,
        destination: redirectRules.overviewUrls[s],
        permanent: true,
      });
    }
    // Api CLI redirection to Nx
    for (let s of Object.keys(redirectRules.cliUrls)) {
      rules.push({
        source: s,
        destination: redirectRules.cliUrls[s],
        permanent: true,
      });
    }

    // Diataxis doc restructure
    for (let s of Object.keys(redirectRules.diataxis)) {
      rules.push({
        source: s,
        destination: redirectRules.diataxis[s],
        permanent: true,
      });
    }
    // Recipes doc restructure
    for (let s of Object.keys(redirectRules.recipesUrls)) {
      rules.push({
        source: s,
        destination: redirectRules.recipesUrls[s],
        permanent: true,
      });
    }
    // Nx Cloud restructure
    for (let s of Object.keys(redirectRules.nxCloudUrls)) {
      rules.push({
        source: s,
        destination: redirectRules.nxCloudUrls[s],
        permanent: true,
      });
    }
    // Tutorials / Getting started
    for (let s of Object.keys(redirectRules.conceptUrls)) {
      rules.push({
        source: s,
        destination: redirectRules.conceptUrls[s],
        permanent: true,
      });
    }

    // Packages Indexes
    for (let s of Object.keys(redirectRules.packagesIndexes)) {
      rules.push({
        source: s,
        destination: redirectRules.packagesIndexes[s],
        permanent: true,
      });
    }
    // Packages Documents
    for (let s of Object.keys(redirectRules.packagesDocuments)) {
      rules.push({
        source: s,
        destination: redirectRules.packagesDocuments[s],
        permanent: true,
      });
    }

    // Docs
    rules.push({
      source: '/docs',
      destination: '/getting-started/intro',
      permanent: true,
    });
    return rules;
  },
});
