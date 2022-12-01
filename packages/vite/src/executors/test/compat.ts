import { convertNxExecutor } from '@nrwl/devkit';
import vitestExecutor from './vitest.impl';

export default convertNxExecutor(vitestExecutor);
