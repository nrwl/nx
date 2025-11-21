import type { Mode } from '@rspack/core';

export interface DevServerExecutorSchema {
  buildTarget: string;
  mode?: Mode;
  host?: string;
  port?: number;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
  proxyConfig?: string;
  publicHost?: string;
}
