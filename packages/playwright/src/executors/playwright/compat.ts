import { convertNxExecutor } from '@nx/devkit';
import { playwrightExecutor } from './playwright';

export default convertNxExecutor(playwrightExecutor);
