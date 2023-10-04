import { convertNxExecutor } from '@nx/devkit';

import installExecutor from './install.impl';

export default convertNxExecutor(installExecutor);
