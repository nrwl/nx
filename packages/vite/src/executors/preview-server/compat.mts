import { convertNxExecutor } from '@nx/devkit';
import vitePreviewServerExecutor from './preview-server.impl.mjs';

export default convertNxExecutor(vitePreviewServerExecutor);
