import { type ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { UnitTestRunner, E2eTestRunner } from '../utils/testing';

export interface Schema {
  name: string;
  path: string;
  remote: string;
  remoteDirectory?: string;
  host?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  unitTestRunner?: UnitTestRunner;
  e2eTestRunner?: E2eTestRunner;
  standalone?: boolean;
  skipFormat?: boolean;
}
