// nx-ignore-next-line
const withNx = require('@nrwl/next/plugins/with-nx');

module.exports = withNx({
  // For both client and server
  env: {
    VERCEL: process.env.VERCEL,
  },
  async redirects() {
    // TODO(jack): Remove in Nx 13
    return [
      {
        source: '/latest/guides/eslint',
        destination: '/guides/eslint',
        permanent: true,
      },
    ];
  },
});
