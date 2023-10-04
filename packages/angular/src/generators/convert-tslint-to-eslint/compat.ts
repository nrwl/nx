import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { conversionGenerator } from './convert-tslint-to-eslint';

/**
 * @deprecated This generator will be removed in v17
 */
export const conversionSchematic = warnForSchematicUsage(
  convertNxGenerator(conversionGenerator)
);
