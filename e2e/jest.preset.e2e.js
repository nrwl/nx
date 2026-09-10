const preset = require('../jest.preset');

// The root preset sets up the environment for unit tests.
delete preset.setupFiles;

// Its mocks are unit-test doubles, so e2e drops them for the real modules. The
// exception is an ESM-only package: that mock already hands back the real
// module, and without it jest cannot load the package at all.
const esmOnly = new Set(['^flat$', '^yargs-parser$']);
preset.moduleNameMapper = Object.fromEntries(
  Object.entries(preset.moduleNameMapper).filter(([pattern]) =>
    esmOnly.has(pattern)
  )
);

module.exports = {
  ...preset,
  // The root preset's timeout is meant for unit tests. Creating a workspace on
  // its own takes longer than that, and because Jest cannot interrupt
  // synchronous work, a hook that has already overrun only fails once it awaits
  // something - which made waiting on a lock, or any other await, look like the
  // culprit. This is high enough to cover setting a workspace up and low enough
  // to still fail a suite that has genuinely hung; suites that need longer set
  // their own.
  testTimeout: 120_000,
};
