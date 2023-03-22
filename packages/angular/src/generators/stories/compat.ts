import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { angularStoriesGenerator } from './stories';

export default warnForSchematicUsage(
  convertNxGenerator(angularStoriesGenerator)
);
