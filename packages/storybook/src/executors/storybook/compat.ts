import { convertNxExecutor } from '@nx/devkit';
import storybookExecutor from './storybook.impl';

export default convertNxExecutor(storybookExecutor);
