import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { storybookConfigurationGenerator } from './storybook-configuration';

export default warnForSchematicUsage(
  convertNxGenerator(storybookConfigurationGenerator)
);
