import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import application from './application';

export const applicationSchematic = warnForSchematicUsage(
  convertNxGenerator(application)
);
