import { convertNxExecutor } from '@nx/devkit';
import nodeExecutor from './node.impl';

export default convertNxExecutor(nodeExecutor);
