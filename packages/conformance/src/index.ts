/**
 * This forms the public API of `@nx/conformance`.
 * @public
 */

export {
  yargsConformanceCheckCommand,
  yargsConformanceCommand,
} from './commands/conformance/command-object';
export {
  ReadOnlyConformanceTree,
  WritableConformanceTree,
} from './conformance-tree';
export * from './types';
export { createConformanceRule } from './utils/create-conformance-rule';
