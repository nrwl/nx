const baseResolver = require('../../scripts/patched-jest-resolver');
const enhancedResolve = require('enhanced-resolve');

// Create a resolver with @nx/nx-source condition for nx package only
const nxSourceResolver = enhancedResolve.create.sync({
  conditionNames: ['@nx/nx-source', 'require', 'node', 'default'],
  extensions: ['.js', '.json', '.node', '.ts', '.tsx'],
});

module.exports = function (modulePath, options) {
  // For nx package internal imports that need @nx/nx-source resolution
  if (modulePath.startsWith('nx/') || modulePath === 'nx') {
    try {
      return nxSourceResolver(options.basedir, modulePath);
    } catch (e) {
      // Fall through to base resolver
    }
  }

  // Use base resolver for everything else
  return baseResolver(modulePath, options);
};
