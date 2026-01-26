import type { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';

export interface Schema {
  name: string;
  path: string;
  remote: string;
  remoteDirectory?: string;
  host?: string;
  unitTestRunner?: Exclude<UnitTestRunner, UnitTestRunner.VitestAngular>;
  e2eTestRunner?: E2eTestRunner;
  standalone?: boolean;
  skipFormat?: boolean;
}
