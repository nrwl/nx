// nx-ignore-next-line
const withNx = require('@nrwl/next/plugins/with-nx');

const redirects = {
  '/core-concepts/configuration': '/configuration/projectjson',
  '/core-concepts/mental-model': '/using-nx/mental-model',
  '/core-concepts/updating-nx': '/using-nx/updating-nx',
  '/using-nx/nx-devkit': '/getting-started/nx-devkit',
  '/getting-started/nx-cli': '/using-nx/nx-cli',
  '/getting-started/console': '/using-nx/console',
  '/core-extended/affected': '/using-nx/affected',
  '/core-extended/computation-caching': '/using-nx/caching',
  '/using-nx/ci-overview': '/using-nx/ci-overview',
};

module.exports = withNx({
  // For both client and server
  env: {
    VERCEL: process.env.VERCEL,
  },
  async redirects() {
    const rules = [];
    for (let s of Object.keys(redirects)) {
      rules.push({
        source: `/l/n${s}`,
        destination: `/l/n${redirects[s]}`,
        permanent: true,
      });

      rules.push({
        source: `/l/r${s}`,
        destination: `/l/r${redirects[s]}`,
        permanent: true,
      });

      rules.push({
        source: `/l/a${s}`,
        destination: `/l/a${redirects[s]}`,
        permanent: true,
      });

      rules.push({
        source: s,
        destination: redirects[s],
        permanent: true,
      });
    }
    return rules;
  },
});
