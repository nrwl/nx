// ESLint needs an ESTree root; the lockfile rule handles the YAML content.
module.exports = {
  parseForESLint: (code) => ({
    ast: {
      type: 'Program',
      loc: { start: 0, end: code.length },
      range: [0, code.length],
      body: [],
      comments: [],
      tokens: [],
    },
    services: { isPlain: true },
    scopeManager: null,
    visitorKeys: {
      Program: [],
    },
  }),
};
