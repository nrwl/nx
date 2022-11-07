module.exports = {
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

  scopes: [
    { name: 'angular', description: 'anything Angular specific' },
    { name: 'core', description: 'anything Nx core specific' },
    {
      name: 'bundling',
      description: 'anything bundling specific (e.g. rollup, webpack, etc.)',
    },
    { name: 'detox', description: 'anything Detox specific' },
    { name: 'devkit', description: 'devkit-related changes' },
    { name: 'express', description: 'anything Express specific' },
    { name: 'graph', description: 'anything graph app specific' },
    { name: 'js', description: 'anything TS->JS specific' },
    { name: 'linter', description: 'anything Linter specific' },
    { name: 'misc', description: 'misc stuff' },
    {
      name: 'module-federation',
      description: 'anything related to the Module Federation package',
    },
    { name: 'nest', description: 'anything Nest specific' },
    { name: 'nextjs', description: 'anything Next specific' },
    { name: 'node', description: 'anything Node specific' },
    { name: 'nx-cloud', description: 'anything NxCloud specific' },
    { name: 'nx-plugin', description: 'anything Nx Plugin specific' },
    { name: 'nxdev', description: 'anything related to docs infrastructure' },
    { name: 'react', description: 'anything React specific' },
    { name: 'react-native', description: 'anything React Native specific' },
    { name: 'expo', description: 'anything Expo specific' },
    {
      name: 'repo',
      description: 'anything related to managing the repo itself',
    },
    { name: 'storybook', description: 'anything Storybook specific' },
    {
      name: 'testing',
      description: 'anything testing specific (e.g., jest or cypress)',
    },
    { name: 'vite', description: 'anything Vite specific' },
    { name: 'web', description: 'anything Web specific' },
    { name: 'webpack', description: 'anything Webpack specific' },
  ],

  allowTicketNumber: true,
  isTicketNumberRequired: false,
  ticketNumberPrefix: 'TICKET-',
  ticketNumberRegExp: '\\d{1,5}',

  // it needs to match the value for field type. Eg.: 'fix'
  /*
  scopeOverrides: {
    fix: [
      {name: 'merge'},
      {name: 'style'},
      {name: 'e2eTest'},
      {name: 'unitTest'}
    ]
  },
  */
  // override the messages, defaults are as follows
  messages: {
    type: "Select the type of change that you're committing:",
    scope: '\nDenote the SCOPE of this change (optional):',
    // used if allowCustomScopes is true
    customScope: 'Denote the SCOPE of this change:',
    subject:
      'Write a SHORT, IMPERATIVE (lowercase) description of the change:\n',
    body: 'Provide a LONGER description of the change (optional). Use "|" to break new line:\n',
    breaking: 'List any BREAKING CHANGES (optional):\n',
    footer:
      'List any ISSUES CLOSED by this change (optional). E.g.: #31, #34:\n',
    confirmCommit: 'Are you sure you want to proceed with the commit above?',
  },

  allowCustomScopes: false,
  allowBreakingChanges: ['feat', 'fix'],
  // skip any questions you want
  skipQuestions: ['ticketNumber'],

  // limit subject length
  subjectLimit: 100,
  // breaklineChar: '|', // It is supported for fields body and footer.
  // footerPrefix : 'ISSUES CLOSED:'
  // askForBreakingChangeFirst : true, // default is false
};
