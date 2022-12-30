import { convertNxExecutor } from '../utils/convert-nx-executor';
import { default as runCommandsExecutor } from './run-commands.impl';

export default convertNxExecutor(runCommandsExecutor);
