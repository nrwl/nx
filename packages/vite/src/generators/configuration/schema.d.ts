export interface Schema {
  uiFramework: 'react' | 'none';
  project: string;
  newProject?: boolean;
  includeVitest?: boolean;
  inSourceTests?: boolean;
  includeLib?: boolean;
}
