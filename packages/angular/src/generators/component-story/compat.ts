import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { componentStoryGenerator } from './component-story';

export default warnForSchematicUsage(
  convertNxGenerator(componentStoryGenerator)
);
