import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { remoteInternal } from './remote';

export default warnForSchematicUsage(convertNxGenerator(remoteInternal));
