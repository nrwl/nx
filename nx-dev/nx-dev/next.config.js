// nx-ignore-next-line
const withNx = require('@nrwl/next/plugins/with-nx');

const redirects = {
  '/core-concepts/configuration': '/configuration/projectjson',
  '/core-concepts/mental-model': '/using-nx/mental-model',
  '/core-concepts/updating-nx': '/using-nx/updating-nx',
  '/core-concepts/ci-overview': '/using-nx/ci-overview',
  '/using-nx/nx-devkit': '/getting-started/nx-devkit',
  '/getting-started/nx-cli': '/using-nx/nx-cli',
  '/getting-started/console': '/using-nx/console',
  '/core-extended/affected': '/using-nx/affected',
  '/core-extended/computation-caching': '/using-nx/caching',
};

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

    // Customs
    for (let s of Object.keys(redirects)) {
      rules.push({
        source: `/l/n${s}`,
        destination: redirects[s],
        permanent: true,
      });

      rules.push({
        source: `/l/r${s}`,
        destination: redirects[s],
        permanent: true,
      });

      rules.push({
        source: `/l/a${s}`,
        destination: redirects[s],
        permanent: true,
      });

      rules.push({
        source: s,
        destination: redirects[s],
        permanent: true,
      });
    }

    // Generic, catch-all
    rules.push({
      source: '/(l|p)/(a|r|n)/:path*',
      destination: '/:path*',
      permanent: true,
    });
    return rules;
  },
});
