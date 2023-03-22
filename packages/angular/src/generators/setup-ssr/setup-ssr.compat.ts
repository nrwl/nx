import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { setupSsr } from './setup-ssr';

export default warnForSchematicUsage(convertNxGenerator(setupSsr));
