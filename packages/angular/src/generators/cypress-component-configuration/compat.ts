import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { cypressComponentConfiguration } from './cypress-component-configuration';

export default warnForSchematicUsage(
  convertNxGenerator(cypressComponentConfiguration)
);
