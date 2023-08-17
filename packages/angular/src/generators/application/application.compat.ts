import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import application from './application';

export const applicationSchematic = warnForSchematicUsage(
  convertNxGenerator(application)
);
