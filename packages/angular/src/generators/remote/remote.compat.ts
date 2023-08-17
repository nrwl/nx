import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import remote from './remote';

export default warnForSchematicUsage(convertNxGenerator(remote));
