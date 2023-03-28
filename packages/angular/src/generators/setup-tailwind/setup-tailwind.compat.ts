import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { setupTailwindGenerator } from './setup-tailwind';

export default warnForSchematicUsage(
  convertNxGenerator(setupTailwindGenerator)
);
