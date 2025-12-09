import { convertNxExecutor } from '@nx/devkit';
import vitestExecutor from './vitest.impl';

export default convertNxExecutor(vitestExecutor);
