import { convertNxExecutor } from '@nrwl/devkit';
import viteBuildExecutor from './build.impl';

export default convertNxExecutor(viteBuildExecutor);
