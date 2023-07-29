import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { librarySecondaryEntryPointGenerator } from './library-secondary-entry-point';

export default warnForSchematicUsage(
  convertNxGenerator(librarySecondaryEntryPointGenerator)
);
