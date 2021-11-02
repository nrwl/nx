import { convertNxGenerator } from '@nrwl/devkit';
import { angularMigrateStoriesTo62Generator } from './migrate-stories-to-6-2';

export default convertNxGenerator(angularMigrateStoriesTo62Generator);
