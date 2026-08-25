import { createHttpClient, type HttpClient } from '../../utils/http-client';
import { logger } from '../../utils/logger';
import { NX_CLOUD_NO_TIMEOUTS, UNLIMITED_TIMEOUT } from './environment';

export function createApiHttpClient(options?: {
  url?: string;
  customProxyConfigPath?: string;
}): HttpClient {
  if (options?.customProxyConfigPath) {
    // The client bundle still reads this file for its own requests
    logger.warn(
      'customProxyConfigPath is not used for downloading the Nx Cloud client. Set HTTP_PROXY/HTTPS_PROXY/NO_PROXY (and NODE_EXTRA_CA_CERTS for custom certificates) instead.'
    );
  }

  return createHttpClient({
    baseURL: process.env.NX_CLOUD_API || options?.url || 'https://cloud.nx.app',
    timeout: NX_CLOUD_NO_TIMEOUTS ? UNLIMITED_TIMEOUT : 10000,
  });
}
