import { convertNxGenerator } from '@nx/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import federateModule from './federate-module';

export default warnForSchematicUsage(convertNxGenerator(federateModule));
