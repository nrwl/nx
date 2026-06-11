import type { NxJsonConfiguration } from '../../config/nx-json';
import type { Tree } from '../tree';
/**
 * Reads nx.json
 */
export declare function readNxJson(tree: Tree): NxJsonConfiguration | null;
/**
 * Update nx.json
 */
export declare function updateNxJson(tree: Tree, nxJson: NxJsonConfiguration): void;
