import { join } from 'path';
import {
  createHttpClient,
  type HttpClient,
  type HttpRequestConfig,
} from '../../utils/http-client';
import { logger } from '../../utils/logger';
import { NX_CLOUD_NO_TIMEOUTS, UNLIMITED_TIMEOUT } from './environment';

export function createApiHttpClient(options?: {
  url?: string;
  customProxyConfigPath?: string;
}): HttpClient {
  const baseUrl =
    process.env.NX_CLOUD_API || options?.url || 'https://cloud.nx.app';

  let config: HttpRequestConfig = {
    baseURL: baseUrl,
    timeout: NX_CLOUD_NO_TIMEOUTS ? UNLIMITED_TIMEOUT : 10000,
  };

  if (options?.customProxyConfigPath) {
    const { nxCloudProxyConfig } = require(
      join(process.cwd(), options.customProxyConfigPath)
    );
    if (nxCloudProxyConfig) {
      // Pre-axios-removal contract: a builder that received an axios config
      const custom = nxCloudProxyConfig(config) ?? config;
      config = {
        baseURL: custom.baseURL ?? config.baseURL,
        timeout: custom.timeout ?? config.timeout,
        headers: custom.headers,
      };
      if (custom.httpAgent || custom.httpsAgent || custom.proxy) {
        logger.warn(
          'The agent/proxy options returned by nxCloudProxyConfig are no longer supported for downloading the Nx Cloud client. Set HTTP_PROXY/HTTPS_PROXY/NO_PROXY (and NODE_EXTRA_CA_CERTS for custom certificates) instead.'
        );
      }
    }
  }

  return createHttpClient(config);
}
