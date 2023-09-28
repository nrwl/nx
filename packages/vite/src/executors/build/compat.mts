import { convertNxExecutor } from '@nx/devkit';
import viteBuildExecutor from './build.impl.mjs';

export default convertNxExecutor(viteBuildExecutor);
