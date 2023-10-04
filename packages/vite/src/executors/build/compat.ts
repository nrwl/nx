import { convertNxExecutor } from '@nx/devkit';
import viteBuildExecutor from './build.impl';

export default convertNxExecutor(viteBuildExecutor);
