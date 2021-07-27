import { convertNxGenerator } from '@nrwl/devkit';
import { upgradeModuleGenerator } from './upgrade-module';

export default convertNxGenerator(upgradeModuleGenerator);
