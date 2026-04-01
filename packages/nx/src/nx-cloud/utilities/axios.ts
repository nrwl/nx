import type { AxiosRequestConfig } from 'axios';
import { join } from 'path';
import { NX_CLOUD_NO_TIMEOUTS, UNLIMITED_TIMEOUT } from './environment';

export function createApiAxiosInstance(options?: {
  url?: string;
  customProxyConfigPath?: string;
}) {
  let axiosConfigBuilder = (axiosConfig: AxiosRequestConfig) => axiosConfig;
  const baseUrl =
    process.env.NX_CLOUD_API || options?.url || 'https://cloud.nx.app';

  if (options?.customProxyConfigPath) {
    const { nxCloudProxyConfig } = require(
      join(process.cwd(), options.customProxyConfigPath)
    );
    axiosConfigBuilder = nxCloudProxyConfig ?? axiosConfigBuilder;
  }

  return require('axios').create(
    axiosConfigBuilder({
      baseURL: baseUrl,
      timeout: NX_CLOUD_NO_TIMEOUTS ? UNLIMITED_TIMEOUT : 10000,
    })
  );
}
