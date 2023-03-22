import componentGenerator from './component';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { convertNxGenerator } from '@nrwl/devkit';

export default warnForSchematicUsage(convertNxGenerator(componentGenerator));
