import {
  createHttpClient,
  getSystemCaUnsupportedMessage,
  isSystemCaSupported,
  type HttpClient,
} from '../../utils/http-client';
import { NX_CLOUD_NO_TIMEOUTS, UNLIMITED_TIMEOUT } from './environment';

export function createApiHttpClient(options?: {
  url?: string;
  customProxyConfigPath?: string;
  useSystemCa?: boolean;
}): HttpClient {
  if (options?.customProxyConfigPath) {
    const { logger } = require('../../utils/logger');
    // The client bundle still reads this file for its own requests
    logger.warn(
      'customProxyConfigPath is not used for downloading the Nx Cloud client. Set HTTP_PROXY/HTTPS_PROXY/NO_PROXY (and NODE_EXTRA_CA_CERTS for custom certificates, or useSystemCa to trust system CA certificates) instead.'
    );
  }

  let useSystemCa = options?.useSystemCa === true;
  if (useSystemCa && !isSystemCaSupported()) {
    const { logger } = require('../../utils/logger');
    logger.warn(
      `useSystemCa is ignored for downloading the Nx Cloud client. ${getSystemCaUnsupportedMessage()}`
    );
    useSystemCa = false;
  }

  return createHttpClient({
    baseURL: process.env.NX_CLOUD_API || options?.url || 'https://cloud.nx.app',
    timeout: NX_CLOUD_NO_TIMEOUTS ? UNLIMITED_TIMEOUT : 10000,
    ...(useSystemCa ? { useSystemCa } : {}),
  });
}
