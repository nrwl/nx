export interface StorybookStoriesSchema {
  project: string;
  interactionTests?: boolean;
  js?: boolean;
  ignorePaths?: string[];
  skipFormat?: boolean;
}
