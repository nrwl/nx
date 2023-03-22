import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { addLintingGenerator } from './add-linting';

export default warnForSchematicUsage(convertNxGenerator(addLintingGenerator));
