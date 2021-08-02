import { Tree } from '@nrwl/devkit';
import {
  createProjectGraph,
  DEPRECATED_GRAPH_VERSION,
} from '../core/project-graph/project-graph';

// TODO(v13): remove this deprecated method
/**
 * @deprecated This method is deprecated and `await {@link createProjectGraphAsync}()` should be used instead
 */
export function createProjectGraphFromTree(tree: Tree) {
  return createProjectGraph(
    undefined,
    undefined,
    undefined,
    DEPRECATED_GRAPH_VERSION
  );
}
