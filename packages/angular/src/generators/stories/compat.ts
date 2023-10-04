import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { angularStoriesGenerator } from './stories';

export default warnForSchematicUsage(
  convertNxGenerator(angularStoriesGenerator)
);
