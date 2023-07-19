export interface StoriesGeneratorOptions {
  name: string;
  interactionTests?: boolean;
  skipFormat?: boolean;
  ignorePaths?: string[];
  /**
   * @deprecated Use interactionTests instead. This option will be removed in v18.
   */
  cypressProject?: string;
  /**
   * @deprecated Use interactionTests instead. This option will be removed in v18.
   */
  generateCypressSpecs?: boolean;
}
