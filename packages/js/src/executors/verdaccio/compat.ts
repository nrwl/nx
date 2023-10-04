import { convertNxExecutor } from '@nx/devkit';

import { verdaccioExecutor } from './verdaccio.impl';

export default convertNxExecutor(verdaccioExecutor);
