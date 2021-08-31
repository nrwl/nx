import { convertNxGenerator } from '@nrwl/devkit';
import { angularInitGenerator } from './init';

export const initSchematic = convertNxGenerator(angularInitGenerator);
