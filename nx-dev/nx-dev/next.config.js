// nx-ignore-next-line
const { withNx } = require('@nx/next/plugins/with-nx');

// For deploy previews, always point to the matching astro-docs preview
// (overrides any site-level env var that would otherwise point to production).
if (
  !global.NX_GRAPH_CREATION &&
  process.env.NETLIFY &&
  process.env.CONTEXT === 'deploy-preview' &&
  process.env.REVIEW_ID
) {
  process.env.NEXT_PUBLIC_ASTRO_URL = `https://deploy-preview-${process.env.REVIEW_ID}--nx-docs.netlify.app`;
  console.log(
    `[deploy-preview] NEXT_PUBLIC_ASTRO_URL overridden to: ${process.env.NEXT_PUBLIC_ASTRO_URL}`
  );
} else if (!process.env.NEXT_PUBLIC_ASTRO_URL && !global.NX_GRAPH_CREATION) {
  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.VERCEL || process.env.NETLIFY)
  ) {
    throw new Error(
      `The NEXT_PUBLIC_ASTRO_URL environment variable is not set. Please set it to the URL of the Astro site.`
    );
  } else {
    // For dev, default to the canary docs.
    process.env.NEXT_PUBLIC_ASTRO_URL = 'https://master--nx-docs.netlify.app';
  }
}

module.exports = withNx({
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    cpus: 1,
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@swc/core-linux-x64-musl/**',
        'node_modules/@swc/core-linux-x64-gnu/**',
        'node_modules/@swc/core-linux-arm64-musl/**',
        'node_modules/@swc/core-linux-arm64-gnu/**',
        'node_modules/@swc/core-linux-arm-gnueabihf/**',
        'node_modules/@swc/core-win32-x64-msvc/**',
        'node_modules/@swc/core-win32-arm64-msvc/**',
        'node_modules/@swc/core-win32-ia32-msvc/**',
        'node_modules/@swc/core-darwin-x64/**',
        'node_modules/@swc/core-darwin-arm64/**',
        'node_modules/@esbuild/**',
        'node_modules/esbuild/**',
        'node_modules/@nx/nx-darwin-arm64/**',
        'node_modules/@nx/nx-darwin-x64/**',
        'node_modules/@nx/nx-freebsd-x64/**',
        'node_modules/@nx/nx-linux-arm-gnueabihf/**',
        'node_modules/@nx/nx-linux-arm64-gnu/**',
        'node_modules/@nx/nx-linux-arm64-musl/**',
        'node_modules/@nx/nx-linux-x64-gnu/**',
        'node_modules/@nx/nx-linux-x64-musl/**',
        'node_modules/@nx/nx-win32-arm64-msvc/**',
        'node_modules/@nx/nx-win32-x64-msvc/**',
        'node_modules/typescript/**',
        'node_modules/webpack/**',
        'node_modules/sass/**',
      ],
    },
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/ai-chat',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const astroDocsUrl = process.env.NEXT_PUBLIC_ASTRO_URL?.replace(/\/$/, '');

    if (!astroDocsUrl) {
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
      {
        source: '/llms.txt',
        destination: `${astroDocsUrl}/docs/llms.txt`,
      },
      {
        source: '/llms-full.txt',
        destination: `${astroDocsUrl}/docs/llms-full.txt`,
      },
    ];

    if (process.env.NODE_ENV !== 'production') {
      entries.push({
        source: '/@fs/:path*',
        destination: `${astroDocsUrl}/@fs/:path*`,
      });
    }

    return entries;
  },
  transpilePackages: [
    '@nx/nx-dev-data-access-courses',
    '@nx/nx-dev-data-access-documents',
    '@nx/nx-dev-feature-ai',
    '@nx/nx-dev-feature-analytics',
    '@nx/nx-dev-feature-search',
    '@nx/nx-dev-models-document',
    '@nx/nx-dev-models-menu',
    '@nx/nx-dev-models-package',
    '@nx/nx-dev-ui-animations',
    '@nx/nx-dev-ui-blog',
    '@nx/nx-dev-ui-common',
    '@nx/nx-dev-ui-courses',
    '@nx/nx-dev-ui-fence',
    '@nx/nx-dev-ui-icons',
    '@nx/nx-dev-ui-markdoc',
    '@nx/nx-dev-ui-primitives',
    '@nx/nx-dev-ui-references',
    '@nx/nx-dev-ui-theme',
    '@nx/nx-dev-ui-video-courses',
    '@nx/nx-dev-util-ai',
  ],
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
  webpack: (config, { dev }) => {
    if (!dev) {
      config.devtool = false;
    }
    return config;
  },
});
