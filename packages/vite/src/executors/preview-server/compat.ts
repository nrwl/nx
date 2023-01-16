import { convertNxExecutor } from '@nrwl/devkit';
import vitePreviewServerExecutor from './preview-server.impl';

export default convertNxExecutor(vitePreviewServerExecutor);
