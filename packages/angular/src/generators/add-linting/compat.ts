import { convertNxGenerator } from '@nrwl/devkit';
import { addLintingGenerator } from './add-linting';

export default convertNxGenerator(addLintingGenerator);
