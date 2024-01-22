export interface VerdaccioExecutorSchema {
  location: 'global' | 'user' | 'project' | 'none';
  storage?: string;
  port: number;
  config?: string;
  clear?: boolean;
}
