// prettier-ignore
const scopes = [
  { value: 'angular',       name: 'angular:         anything Angular specific' },
  { value: 'core',          name: 'core:            anything Nx core specific' },
  { value: 'bundling',      name: 'bundling:        anything bundling specific (e.g. rollup, webpack, etc.)' },
  { value: 'detox',         name: 'detox:           anything Detox specific' },
  { value: 'devkit',        name: 'devkit:          devkit-related changes' },
  { value: 'express',       name: 'express:         anything Express specific' },
  { value: 'graph',         name: 'graph:           anything graph app specific' },
  { value: 'js',            name: 'js:              anything TS->JS specific' },
  { value: 'linter',        name: 'linter:          anything Linter specific' },
  { value: 'misc',          name: 'misc:            misc stuff' },
  { value: 'nest',          name: 'nest:            anything Nest specific' },
  { value: 'nextjs',        name: 'nextjs:          anything Next specific' },
  { value: 'node',          name: 'node:            anything Node specific' },
  { value: 'nx-cloud',      name: 'nx-cloud:        anything NxCloud specific' },
  { value: 'nx-plugin',     name: 'nx-plugin:       anything Nx Plugin specific' },
  { value: 'nx-dev',         name: 'nx-dev:         anything related to docs infrastructure' },
  { value: 'react',         name: 'react:           anything React specific' },
  { value: 'react-native',  name: 'react-native:    anything React Native specific' },
  { value: 'expo',          name: 'expo:            anything Expo specific' },
  { value: 'repo',          name: 'repo:            anything related to managing the repo itself' },
  { value: 'storybook',     name: 'storybook:       anything Storybook specific' },
  { value: 'testing',       name: 'testing:         anything testing specific (e.g. jest or cypress)' },
  { value: 'vite',          name: 'vite:            anything Vite specific' },
  { value: 'web',           name: 'web:             anything Web specific' },
  { value: 'webpack',       name: 'webpack:         anything Webpack specific' },
];

// precomputed scope
const scopeComplete = require('child_process')
  .execSync('git status --porcelain || true')
  .toString()
  .trim()
  .split('\n')
  .find((r) => ~r.indexOf('M  packages'))
  ?.replace(/(\/)/g, '%%')
  ?.match(/packages%%((\w|-)*)/)?.[1];

/** @type {import('cz-git').CommitizenGitOptions} */
module.exports = {
  /** @usage `pnpm commit :f` */
  alias: {
    f: 'docs(core): fix typos',
    b: 'chore(repo): bump dependencies',
  },
  scopes,
  defaultScope: scopeComplete,
  scopesSearchValue: true,
  maxSubjectLength: 100,
  allowCustomScopes: false,
  allowEmptyScopes: false,
  allowCustomIssuePrefix: false,
  allowEmptyIssuePrefix: false,
  types: [
    { value: 'feat', name: 'feat:     A new feature' },
    { value: 'fix', name: 'fix:      A bug fix' },
    { value: 'docs', name: 'docs:     Documentation only changes' },
    {
      value: 'cleanup',
      name: 'cleanup:  A code change that neither fixes a bug nor adds a feature',
    },
    {
      value: 'chore',
      name: "chore:    Other changes that don't modify src or test files",
    },
  ],
};
