import { nxReadySignal } from './src/utils/ready-signal';

// @nuxt/kit 4.6 loads modules with a native `import()`, which takes the
// `module.exports` of a CommonJS module as its default
export = nxReadySignal;
