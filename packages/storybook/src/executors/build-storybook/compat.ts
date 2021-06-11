import { convertNxExecutor } from '@nrwl/devkit';
import buildStorybookExecutor from './build-storybook.impl';

export default convertNxExecutor(buildStorybookExecutor);
