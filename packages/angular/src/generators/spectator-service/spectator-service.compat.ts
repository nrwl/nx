import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { spectatorServiceGenerator } from './spectator-service';

export default warnForSchematicUsage(
  convertNxGenerator(spectatorServiceGenerator)
);
