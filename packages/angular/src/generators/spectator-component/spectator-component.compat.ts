import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { spectatorComponentGenerator } from './spectator-component';

export default warnForSchematicUsage(
  convertNxGenerator(spectatorComponentGenerator)
);
