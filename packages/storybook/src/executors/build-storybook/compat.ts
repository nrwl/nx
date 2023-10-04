import { convertNxExecutor } from '@nx/devkit';
import buildStorybookExecutor from './build-storybook.impl';

export default convertNxExecutor(buildStorybookExecutor);
