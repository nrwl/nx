import { convertNxExecutor } from '@nx/devkit';
import { swcExecutor } from './swc.impl';

export default convertNxExecutor(swcExecutor);
