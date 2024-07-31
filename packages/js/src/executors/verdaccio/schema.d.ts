export interface VerdaccioExecutorSchema {
  location: 'global' | 'user' | 'project' | 'none';
  storage?: string;
  port?: number;
  listenAddress?: string;
  config?: string;
  clear?: boolean;
  scopes?: string[];
}
