import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { setupTailwindGenerator } from './setup-tailwind';

export default warnForSchematicUsage(
  convertNxGenerator(setupTailwindGenerator)
);
