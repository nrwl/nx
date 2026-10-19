// jest-haste-map is not a direct dependency, so resolve the copy jest-runtime uses.
const HasteMap = require(
  require.resolve('jest-haste-map', {
    paths: [require.resolve('jest-runtime')],
  })
).default;

// Skips reading every file under `roots` for its imports. Only
// --findRelatedTests, --onlyChanged and watch mode use them, and the reads
// depend on whether an earlier task on the machine warmed Jest's cache.
module.exports = class E2eHasteMap extends HasteMap {
  constructor(options) {
    const patched = { ...options, computeDependencies: false };
    super(patched);
    // Jest's own factory awaits this; a custom haste map is only constructed.
    this.cachePathReady = this.setupCachePath(patched);
  }

  async build() {
    await this.cachePathReady;
    return super.build();
  }
};
