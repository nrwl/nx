import scamPipeGenerator from './scam-pipe';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { convertNxGenerator } from '@nx/devkit';

export default warnForSchematicUsage(convertNxGenerator(scamPipeGenerator));
