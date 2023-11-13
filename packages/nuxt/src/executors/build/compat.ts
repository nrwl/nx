import { convertNxExecutor } from '@nx/devkit';
import nuxtBuildExecutor from './build.impl';

export default convertNxExecutor(nuxtBuildExecutor);
