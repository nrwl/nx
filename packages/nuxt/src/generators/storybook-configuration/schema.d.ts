import { LinterType } from '@nx/js';

export interface Schema {
  project: string;
  interactionTests?: boolean;
  generateStories?: boolean;
  js?: boolean;
  tsConfiguration?: boolean;
  linter?: LinterType;
  ignorePaths?: string[];
  configureStaticServe?: boolean;
}
