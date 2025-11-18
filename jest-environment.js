const NodeEnvironment = require('jest-environment-node').default;

/**
 * Custom Jest environment that patches Object.defineProperty to allow
 * reconfiguration of spied properties.
 *
 * This is necessary because TypeScript project references change how modules
 * are resolved, causing Jest spies to fail with "Cannot redefine property" errors.
 */
class CustomEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
  }

  async setup() {
    await super.setup();

    // Patch Object.defineProperty to allow reconfiguration of spied properties
    const originalDefineProperty = Object.defineProperty;
    this.global.Object.defineProperty = function (obj, prop, descriptor) {
      if (descriptor && typeof descriptor.configurable === 'undefined') {
        descriptor.configurable = true;
      }
      try {
        return originalDefineProperty(obj, prop, descriptor);
      } catch (e) {
        // If we can't redefine, try to delete and define
        if (e.message && e.message.includes('Cannot redefine property')) {
          try {
            delete obj[prop];
            return originalDefineProperty(obj, prop, descriptor);
          } catch {
            // If that also fails, just return the object
            return obj;
          }
        }
        throw e;
      }
    };
  }
}

module.exports = CustomEnvironment;
