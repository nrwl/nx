import { convertNxExecutor } from '@nx/devkit';
import nuxtServeExecutor from './serve.impl';

export default convertNxExecutor(nuxtServeExecutor);
