import type { ProjectConfiguration } from '@nrwl/devkit';

export type AngularProjectConfiguration = ProjectConfiguration & {
  prefix?: string;
};
