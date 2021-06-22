import { convertNxGenerator } from '@nrwl/devkit';
import { downgradeModuleGenerator } from './downgrade-module';

export default convertNxGenerator(downgradeModuleGenerator);
