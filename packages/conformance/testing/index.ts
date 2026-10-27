/**
 * This forms the public API of `@nx/conformance/testing`.
 * @public
 */

export { createReadOnlyTree } from './create-read-only-tree';
export {
  applyProjectNodesAndFiles,
  createStubbedProjectGraphAndFileMapCache,
  type ProjectNodesWithFiles,
} from './project-graph';

// Re-export to help with unit testing
export { convertToReadOnly, convertToWritable } from '../src/conformance-tree';
