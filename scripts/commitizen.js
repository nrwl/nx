// prettier-ignore
const scopes = [
  { value: 'angular',       name: 'angular:       anything Angular specific' },
  { value: 'core',          name: 'core:          anything Nx core specific' },
  { value: 'nxdev',         name: 'nxdev:         anything related to docs infrastructure' },
  { value: 'nextjs',        name: 'nextjs:        anything Next specific' },
  { value: 'nest',          name: 'nest:          anything Nest specific' },
  { value: 'node',          name: 'node:          anything Node specific' },
  { value: 'js',            name: 'js:            anything TS->JS specific' },
  { value: 'express',       name: 'express:       anything Express specific' },
  { value: 'nx-plugin',     name: 'nx-plugin:     anything Nx Plugin specific' },
  { value: 'react',         name: 'react:         anything React specific' },
  { value: 'react-native',  name: 'react-native:  anything React Native specific' },
  { value: 'detox',         name: 'detox:         anything Detox specific' },
  { value: 'web',           name: 'web:           anything Web specific' },
  { value: 'linter',        name: 'linter:        anything Linter specific' },
  { value: 'storybook',     name: 'storybook:     anything Storybook specific' },
  { value: 'dep-graph',     name: 'dep-graph:     anything dep-graph app specific' },
  { value: 'testing',       name: 'testing:       anything testing specific (e.g. jest or cypress)' },
  { value: 'repo',          name: 'repo:          anything related to managing the repo itself' },
  { value: 'misc',          name: 'misc:          misc stuff' },
  { value: 'devkit',        name: 'devkit:        devkit-related changes' },
];

/** @type {import('cz-git').CommitizenGitOptions} */
module.exports = {
  alias: {
    f: 'docs(core): fix typos',
    b: 'chore(repo): bump dependencies',
  },
  maxSubjectLength: 100,
  allowCustomScopes: false,
  allowEmptyScopes: false,
  allowCustomIssuePrefixs: false,
  allowEmptyIssuePrefixs: false,
  scopes: [...scopes],
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
