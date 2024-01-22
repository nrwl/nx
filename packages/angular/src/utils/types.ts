import type { ProjectConfiguration } from '@nx/devkit';

export type AngularProjectConfiguration = ProjectConfiguration & {
  prefix?: string;
};
