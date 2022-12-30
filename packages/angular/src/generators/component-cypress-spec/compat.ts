import { convertNxGenerator } from '@nrwl/devkit';
import { componentCypressSpecGenerator } from './component-cypress-spec';

export default convertNxGenerator(componentCypressSpecGenerator);
