const preset = require('../jest.preset');

// The root preset sets up the environment for unit tests.
delete preset.setupFiles;
delete preset.moduleNameMapper;

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
