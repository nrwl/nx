import { convertNxGenerator } from '@nx/devkit';
import { ngAddGenerator } from './ng-add';

export default convertNxGenerator(ngAddGenerator, true);
