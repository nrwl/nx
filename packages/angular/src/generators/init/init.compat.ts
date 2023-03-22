import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { angularInitGenerator } from './init';

export const initSchematic = warnForSchematicUsage(
  convertNxGenerator(angularInitGenerator)
);
