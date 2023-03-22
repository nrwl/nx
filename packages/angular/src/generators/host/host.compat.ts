import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import host from './host';

export default warnForSchematicUsage(convertNxGenerator(host));
