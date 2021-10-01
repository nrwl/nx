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
    { name: 'nxdev', description: 'anything related to docs infrastructure' },
    { name: 'nextjs', description: 'anything Next specific' },
    { name: 'gatsby', description: 'anything Gatsby specific' },
    { name: 'nest', description: 'anything Nest specific' },
    { name: 'node', description: 'anything Node specific' },
    { name: 'express', description: 'anything Express specific' },
    { name: 'nx-plugin', description: 'anything Nx Plugin specific' },
    { name: 'react', description: 'anything React specific' },
    { name: 'react-native', description: 'anything React Native specific' },
    { name: 'web', description: 'anything Web specific' },
    { name: 'linter', description: 'anything Linter specific' },
    { name: 'storybook', description: 'anything Storybook specific' },
    { name: 'dep-graph', description: 'anything dep-graph app specific' },
    {
      name: 'testing',
      description: 'anything testing specific (e.g., jest or cypress)',
    },
    {
      name: 'repo',
      description: 'anything related to managing the repo itself',
    },
    { name: 'misc', description: 'misc stuff' },
    { name: 'devkit', description: 'devkit-related changes' },
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
