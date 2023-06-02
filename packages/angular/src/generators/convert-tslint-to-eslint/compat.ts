import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { conversionGenerator } from './convert-tslint-to-eslint';

export const conversionSchematic = warnForSchematicUsage(
  convertNxGenerator(conversionGenerator)
);
