import { convertNxExecutor } from '@nx/devkit';
import vitestExecutor from './vitest.impl.mjs';

export default convertNxExecutor(vitestExecutor);
