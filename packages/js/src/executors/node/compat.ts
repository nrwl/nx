import { convertNxExecutor } from '@nrwl/devkit';
import nodeExecutor from './node.impl';

export default convertNxExecutor(nodeExecutor);
