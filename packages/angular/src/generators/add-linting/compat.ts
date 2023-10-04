import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { addLintingGenerator } from './add-linting';

export default warnForSchematicUsage(convertNxGenerator(addLintingGenerator));
