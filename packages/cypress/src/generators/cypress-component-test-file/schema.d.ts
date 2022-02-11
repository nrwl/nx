export interface CypressComponentTestFileSchema {
  project: string;
  name: string;
  componentType: 'react' | 'next';
  /**
   * The directory path is expected to from the project source root
   */
  directory?: string;
}
