import { convertNxExecutor } from '@nrwl/devkit';
import { swcExecutor } from './swc.impl';

export default convertNxExecutor(swcExecutor);
