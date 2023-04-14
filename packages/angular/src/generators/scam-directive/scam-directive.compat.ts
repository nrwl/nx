import scamGenerator from './scam-directive';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { convertNxGenerator } from '@nx/devkit';

export default warnForSchematicUsage(convertNxGenerator(scamGenerator));
