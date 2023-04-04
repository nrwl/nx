import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { componentGenerator } from './component';

export default warnForSchematicUsage(convertNxGenerator(componentGenerator));
