import { convertNxGenerator } from '@nrwl/devkit';
import { warnForSchematicUsage } from '../utils/warn-for-schematic-usage';
import { webWorkerGenerator } from './web-worker';

export default warnForSchematicUsage(convertNxGenerator(webWorkerGenerator));
