import { convertNxGenerator } from '@nrwl/devkit';
import { webWorkerGenerator } from './web-worker';

export default convertNxGenerator(webWorkerGenerator);
