import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { componentGenerator } from './component';

export default warnForSchematicUsage(convertNxGenerator(componentGenerator));
