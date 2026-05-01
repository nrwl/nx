import { createDependencies as _createDependencies } from './src/plugin/dependencies';
import { createNodesV2 as _createNodesV2 } from './src/plugin/nodes';

const isDisabled = process.env.NX_GRADLE_DISABLE === 'true';

export const name = isDisabled ? '@nx/gradle [disabled]' : '@nx/gradle';
export const createNodesV2 = isDisabled ? undefined : _createNodesV2;
export const createNodes = createNodesV2;
export const createDependencies = isDisabled ? undefined : _createDependencies;
