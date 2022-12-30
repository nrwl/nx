import { convertNxExecutor } from '../utils/convert-nx-executor';

import { default as runScriptExecutor } from './run-script.impl';

export default convertNxExecutor(runScriptExecutor);
