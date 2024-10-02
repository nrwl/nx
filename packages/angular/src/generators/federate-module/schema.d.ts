import { UnitTestRunner, E2eTestRunner } from '../utils/testing';

export interface Schema {
  name: string;
  path: string;
  remote: string;
  remoteDirectory?: string;
  host?: string;
  unitTestRunner?: UnitTestRunner;
  e2eTestRunner?: E2eTestRunner;
  standalone?: boolean;
  skipFormat?: boolean;
}
