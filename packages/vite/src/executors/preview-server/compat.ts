import { convertNxExecutor } from '@nx/devkit';
import vitePreviewServerExecutor from './preview-server.impl';

export default convertNxExecutor(vitePreviewServerExecutor);
