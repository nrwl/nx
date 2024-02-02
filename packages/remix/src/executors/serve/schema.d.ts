export interface RemixServeSchema {
  port: number;
  devServerPort?: number;
  debug?: boolean;
  command?: string;
  manual?: boolean;
  tlsKey?: string;
  tlsCert?: string;
}
