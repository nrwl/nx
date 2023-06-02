import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { angularMoveGenerator } from './move';

export const angularMoveSchematic = warnForSchematicUsage(
  convertNxGenerator(angularMoveGenerator)
);
