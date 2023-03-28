import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { setupMf } from './setup-mf';

export default warnForSchematicUsage(convertNxGenerator(setupMf));
