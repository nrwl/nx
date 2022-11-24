import { findNodes as _findNodes } from 'nx/src/utils/typescript';
import type { Node, SyntaxKind } from 'typescript';

// TODO(v16): This should be removed.

/**
 * @deprecated This function is deprecated and no longer supported.
 */
export function findNodes(
  node: Node,
  kind: SyntaxKind | SyntaxKind[],
  max = Infinity
) {
  console.warn('"findNodes" is deprecated and no longer supported.');
  return _findNodes(node, kind, max);
}
