import { createDependencies as _createDependencies } from './src/plugin/dependencies';
import { createNodes as _createNodes } from './src/plugin/nodes';

const isDisabled = process.env.NX_GRADLE_DISABLE === 'true';

export const name = isDisabled ? '@nx/gradle [disabled]' : '@nx/gradle';
export const createNodes = isDisabled ? undefined : _createNodes;
/**
 * @deprecated Use {@link createNodes} instead. This will be removed in Nx 24.
 */
export const createNodesV2 = createNodes;
export const createDependencies = isDisabled ? undefined : _createDependencies;
