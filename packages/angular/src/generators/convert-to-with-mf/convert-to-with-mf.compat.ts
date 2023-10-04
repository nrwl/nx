import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import convertToWithMF from './convert-to-with-mf';

export default warnForSchematicUsage(convertNxGenerator(convertToWithMF));
