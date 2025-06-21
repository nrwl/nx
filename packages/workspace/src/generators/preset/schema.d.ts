import { Preset } from '../utils/presets';
import { PackageManager } from '@nx/devkit';

export interface Schema {
  name: string;
  preset: Preset;
  style?: string;
  linter?: string;
  formatter?: string;
  workspaces?: boolean;
  standaloneConfig?: boolean;
  framework?: string;
  packageManager?: string;
  bundler?: string;
  docker?: boolean;
  nextAppDir?: boolean;
  nextSrcDir?: boolean;
  routing?: boolean;
  useReactRouter?: boolean;
  standaloneApi?: boolean;
  unitTestRunner?: string;
  e2eTestRunner?: string;
  js?: boolean;
  ssr?: boolean;
  serverRouting?: boolean;
  prefix?: string;
  nxCloudToken?: string;
  useProjectJson?: boolean;
}
