import { convertNxExecutor } from '@nrwl/devkit';
import executor from './lint.impl';

export default convertNxExecutor(executor);
