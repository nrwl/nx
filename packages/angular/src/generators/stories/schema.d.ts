export interface StoriesGeneratorOptions {
  name: string;
  interactionTests?: boolean;
  skipFormat?: boolean;
  ignorePaths?: string[];
  cypressProject?: string;
  generateCypressSpecs?: boolean;
}
