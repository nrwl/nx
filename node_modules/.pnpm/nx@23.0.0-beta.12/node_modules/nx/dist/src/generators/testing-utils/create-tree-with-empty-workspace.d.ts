import type { Tree } from '../tree';
/**
 * Creates a host for testing.
 */
export declare function createTreeWithEmptyWorkspace(opts?: {
    layout?: "apps-libs";
}): Tree;
/**
 * @deprecated use createTreeWithEmptyWorkspace instead
 */
export declare function createTreeWithEmptyV1Workspace(): Tree;
