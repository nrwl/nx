import { convertNxExecutor } from '@nrwl/devkit';
import { storybookCompositionExecutor } from './composition.impl';

export default convertNxExecutor(storybookCompositionExecutor);
