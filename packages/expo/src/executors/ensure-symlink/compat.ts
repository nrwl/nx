import { convertNxExecutor } from '@nx/devkit';

import ensureSymlinkExecutor from './ensure-symlink.impl';

export default convertNxExecutor(ensureSymlinkExecutor);
