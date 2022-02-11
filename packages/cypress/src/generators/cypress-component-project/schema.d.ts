export interface CypressComponentProjectSchema {
  project: string;
  componentType: 'react' | 'next';
  compiler: 'swc' | 'babel';
  force?: boolean;
}
