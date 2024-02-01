export interface CreateComponentStoriesFileSchema {
  project: string;
  componentPath: string;
  interactionTests?: boolean;
  skipFormat?: boolean;
}
