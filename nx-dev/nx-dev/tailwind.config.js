// @ts-check

const path = require('node:path');

module.exports = {
  experimental: {
    optimizeUniversalDefaults: true,
  },
  mode: 'jit',
  darkMode: 'class',
  content: [
    path.join(__dirname, '{pages,app}/**/!(*.stories|*.spec).{js,ts,jsx,tsx}'),
    // List specific dep projects rather than `../ui-*` / `../feature-*` so
    // tailwind's dir-dependency (forwarded to webpack via postcss-loader)
    // doesn't end up snapshotting siblings nx-dev doesn't depend on
    // (ui-podcast, ui-pricing, feature-feedback) — those would otherwise pull
    // their project-root files (eslint configs, etc.) into webpack's hash set.
    ...[
      'ui-animations',
      'ui-blog',
      'ui-common',
      'ui-courses',
      'ui-fence',
      'ui-icons',
      'ui-markdoc',
      'ui-primitives',
      'ui-references',
      'ui-theme',
      'ui-video-courses',
      'feature-ai',
      'feature-analytics',
      'feature-search',
    ].map((dir) => `../${dir}/src/**/!(*.stories|*.spec).{js,ts,jsx,tsx}`),
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            'code::before': { content: '' },
            'code::after': { content: '' },
            'blockquote p:first-of-type::before': { content: '' },
            'blockquote p:last-of-type::after': { content: '' },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/typography'),
  ],
};
