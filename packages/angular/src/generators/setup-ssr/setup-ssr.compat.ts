import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { setupSsr } from './setup-ssr';

export default warnForSchematicUsage(convertNxGenerator(setupSsr));
