// nx-ignore-next-line
const { withNx } = require('@nx/next/plugins/with-nx');
const redirectRules = require('./redirect-rules');

module.exports = withNx({
  // Disable the type checking for now, we need to resolve the issues first.
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    // Only configure rewrites if NEXT_PUBLIC_ASTRO_URL is set
    const astroDocsUrl = process.env.NEXT_PUBLIC_ASTRO_URL;

    if (!astroDocsUrl) {
      // Skip rewrites if env var is not set
      return [];
    }

    const entries = [
      {
        source: '/docs',
        destination: `${astroDocsUrl}/docs`,
      },
      {
        source: '/docs/:path*',
        destination: `${astroDocsUrl}/docs/:path*`,
      },
      {
        source: '/.netlify/:path*',
        destination: `${astroDocsUrl}/.netlify/:path*`,
      },
    ];

    // For Vite assets only in development mode
    if (process.env.NODE_ENV !== 'production') {
      entries.push({
        source: '/@fs/:path*',
        destination: `${astroDocsUrl}/@fs/:path*`,
      });
    }

    return entries;
  },
  // Transpile nx-dev packages
  transpilePackages: [
    '@nx/nx-dev-data-access-documents',
    '@nx/nx-dev-data-access-packages',
    '@nx/nx-dev-data-access-menu',
    '@nx/nx-dev-data-access-courses',
    '@nx/nx-dev-data-access-careers',
    '@nx/nx-dev-models-document',
    '@nx/nx-dev-models-package',
    '@nx/nx-dev-models-menu',
    '@nx/nx-dev-ui-markdoc',
    '@nx/nx-dev-ui-common',
    '@nx/nx-dev-ui-fence',
    '@nx/nx-dev-ui-primitives',
    '@nx/nx-dev-ui-icons',
    '@nx/nx-dev-ui-theme',
    '@nx/nx-dev-ui-references',
    '@nx/nx-dev-feature-search',
    '@nx/nx-dev-feature-analytics',
    '@nx/nx-dev-feature-feedback',
    '@nx/nx-dev-feature-doc-viewer',
    '@nx/nx-dev-feature-package-schema-viewer',
    '@nx/nx-dev-feature-ai',
    '@nx/nx-dev-ui-animations',
    '@nx/nx-dev-ui-blog',
    '@nx/nx-dev-ui-brands',
    '@nx/nx-dev-ui-careers',
    '@nx/nx-dev-ui-cloud',
    '@nx/nx-dev-ui-commands',
    '@nx/nx-dev-ui-community',
    '@nx/nx-dev-ui-company',
    '@nx/nx-dev-ui-conference',
    '@nx/nx-dev-ui-contact',
    '@nx/nx-dev-ui-courses',
    '@nx/nx-dev-ui-customers',
    '@nx/nx-dev-ui-enterprise',
    '@nx/nx-dev-ui-gradle',
    '@nx/nx-dev-ui-home',
    '@nx/nx-dev-ui-member-card',
    '@nx/nx-dev-ui-partners',
    '@nx/nx-dev-ui-podcast',
    '@nx/nx-dev-ui-powerpack',
    '@nx/nx-dev-ui-pricing',
    '@nx/nx-dev-ui-react',
    '@nx/nx-dev-ui-remote-cache',
    '@nx/nx-dev-ui-scrollable-content',
    '@nx/nx-dev-ui-sponsor-card',
    '@nx/nx-dev-ui-video-courses',
    '@nx/nx-dev-ui-webinar',
    '@nx/nx-dev-util-ai',
  ],
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
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
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
