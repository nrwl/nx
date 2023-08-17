import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { hostInternal } from './host';

export default warnForSchematicUsage(convertNxGenerator(hostInternal));
