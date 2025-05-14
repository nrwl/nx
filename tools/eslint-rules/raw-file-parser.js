/**
 * We have a custom lint rule for our pnpm-lock.yaml file and naturally ESLint does not natively know how to parse it.
 * Rather than using a full yaml parser for this one case (which will need to spend time creating a real AST for the giant
 * lock file), we can instead use a custom parser which just immediately returns a dummy AST and then build the reading of
 * the lock file into the rule itself.
 */
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
