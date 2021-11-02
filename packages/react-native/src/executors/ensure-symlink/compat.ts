import { convertNxExecutor } from '@nrwl/devkit';

import ensureSymlinkExecutor from './ensure-symlink.impl';

export default convertNxExecutor(ensureSymlinkExecutor);
