import { join } from 'path';
import {
  createHttpClient,
  type HttpClient,
  type HttpRequestConfig,
} from '../../utils/http-client';
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
      // nxCloudProxyConfig predates the axios removal: a builder that
      // received an axios config. The http client honors the axios fields
      // (baseURL, timeout, headers, httpAgent, httpsAgent, proxy).
      config = nxCloudProxyConfig(config) ?? config;
    }
  }

  return createHttpClient(config);
}
