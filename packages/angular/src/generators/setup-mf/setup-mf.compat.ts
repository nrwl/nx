import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { setupMf } from './setup-mf';

export default warnForSchematicUsage(convertNxGenerator(setupMf));
