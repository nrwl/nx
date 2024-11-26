// nx-ignore-next-line
const { withNx } = require('@nx/next/plugins/with-nx');
const redirectRules = require('./redirect-rules');

module.exports = withNx({
  // Disable the type checking for now, we need to resolve the issues first.
  typescript: {
    ignoreBuildErrors: true,
  },
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

    // Apply all the redirects from the redirect-rules.js file
    for (const section of Object.keys(redirectRules)) {
      for (const source of Object.keys(redirectRules[section])) {
        rules.push({
          source: source,
          destination: redirectRules[section][source],
          permanent: true,
        });
      }
    }

    return rules;
  },
});
