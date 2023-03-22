import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import library from './library';

export const librarySchematic = warnForSchematicUsage(
  convertNxGenerator(library)
);
