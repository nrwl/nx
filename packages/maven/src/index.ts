import { createNodes as _createNodes } from './plugins/nodes';
import { createDependencies as _createDependencies } from './plugins/dependencies';

const isDisabled = process.env.NX_MAVEN_DISABLE === 'true';

export const name = isDisabled ? '@nx/maven [disabled]' : '@nx/maven';
export const createNodes = isDisabled ? undefined : _createNodes;
export const createNodesV2 = createNodes;
export const createDependencies = isDisabled ? undefined : _createDependencies;
