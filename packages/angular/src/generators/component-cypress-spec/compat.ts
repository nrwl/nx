import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { componentCypressSpecGenerator } from './component-cypress-spec';

export default warnForSchematicUsage(
  convertNxGenerator(componentCypressSpecGenerator)
);
