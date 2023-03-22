import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { componentTestGenerator } from './component-test';

export default warnForSchematicUsage(
  convertNxGenerator(componentTestGenerator)
);
