// @ts-check

const path = require('node:path');

// Ignore these nx related dependencies since they are the installed versions not the ones in the workspace
// nx-ignore-next-line
const { workspaceRoot } = require('@nx/devkit');

const glob = '**/!(*.stories|*.spec).{js,ts,jsx,tsx,html}';

module.exports = {
  content: [
    path.join(__dirname, 'src', glob),
    // Enumerate ui-* dirs explicitly. The previous `ui-*/src/**` wildcard
    // forced Tailwind to readdir the parent `graph/` to enumerate matches,
    // which it then reported to postcss-loader as a context dependency. That
    // caused webpack to hash every file under `graph/` (including unrelated
    // siblings like graph/client-e2e and the pnpm symlink chain into
    // packages/{nx,devkit}) for snapshot validation. Listing each leaf dir
    // here keeps Tailwind's directory enumeration scoped per-project and
    // prevents that walk. Add entries here when new graph ui-* projects are
    // introduced.
    path.join(__dirname, '..', 'ui-code-block/src', glob),
    path.join(__dirname, '..', 'ui-common/src', glob),
    path.join(__dirname, '..', 'ui-icons/src', glob),
    path.join(__dirname, '..', 'ui-project-details/src', glob),
    path.join(__dirname, '..', 'ui-render-config/src', glob),
    path.join(__dirname, '..', 'shared/src', glob),
    // Resolve the classes used in @nx/graph components
    // TODO: make a decision on whether this is really the best approach, or if precompiling and deduplicating the classes would be better
    path.join(workspaceRoot, 'node_modules/@nx/graph', glob),
  ],
  darkMode: 'class', // or 'media' or 'class'
  theme: {
    data: {
      checked: 'headlessui-state~="checked"',
    },
    extend: {
      typography: {
        DEFAULT: {
          css: {
            'code::before': {
              content: '',
            },
            'code::after': {
              content: '',
            },
            'blockquote p:first-of-type::before': {
              content: '',
            },
            'blockquote p:last-of-type::after': {
              content: '',
            },
          },
        },
      },
    },
  },
  variants: {
    extend: {
      translate: ['group-hover'],
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
  ],
};
