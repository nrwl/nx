// nx-ignore-next-line
const withNx = require('@nrwl/next/plugins/with-nx');
const { copy } = require('fs-extra');
const path = require('path');
const redirectRules = require('./redirect-rules.config');

/**
 * TODO@ben: Temporary solution before Nextjs' assets management tasks is up and running
 */
copy(
  path.resolve(__dirname + '/../../docs'),
  path.resolve(__dirname + '/public/documentation'),
  { overwrite: true }
);

module.exports = withNx({
  // For both client and server
  env: {
    VERCEL: process.env.VERCEL,
  },
  async redirects() {
    const rules = [];

    // Landing pages
    rules.push({
      source: '/(angular|react|node)',
      destination: '/',
      permanent: true,
    });

    // Tutorials
    rules.push({
      source: '/(l|latest)/(r|react)/tutorial/01-create-application',
      destination: '/react-tutorial/01-create-application',
      permanent: true,
    });
    rules.push({
      source: '/(l|latest)/(a|angular)/tutorial/01-create-application',
      destination: '/angular-tutorial/01-create-application',
      permanent: true,
    });
    rules.push({
      source: '/(l|latest)/(n|node)/tutorial/01-create-application',
      destination: '/node-tutorial/01-create-application',
      permanent: true,
    });

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

    // Schemas (generators & executors)
    for (let s of Object.keys(redirectRules.schemaUrls)) {
      rules.push({
        source: s,
        destination: redirectRules.schemaUrls[s],
        permanent: true,
      });
    }

    // Generic, catch-all
    rules.push({
      source: '/(l|latest|p|previous)/(a|angular|r|react|n|node)/:path*',
      destination: '/:path*',
      permanent: true,
    });
    return rules;
  },
});
