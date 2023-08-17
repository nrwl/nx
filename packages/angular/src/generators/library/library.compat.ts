import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { libraryGeneratorInternal } from './library';

export const librarySchematic = warnForSchematicUsage(
  convertNxGenerator(libraryGeneratorInternal)
);
