import { AxiosRequestConfig } from 'axios';
import { join } from 'path';
import {
  ACCESS_TOKEN,
  NX_CLOUD_NO_TIMEOUTS,
  UNLIMITED_TIMEOUT,
} from './environment';
import { CloudTaskRunnerOptions } from '../nx-cloud-tasks-runner-shell';

const axios = require('axios');

export function createApiAxiosInstance(options: CloudTaskRunnerOptions) {
  let axiosConfigBuilder = (axiosConfig: AxiosRequestConfig) => axiosConfig;
  const baseUrl =
    process.env.NX_CLOUD_API || options.url || 'https://cloud.nx.app';
  const accessToken = ACCESS_TOKEN ? ACCESS_TOKEN : options.accessToken!;
  const nxCloudId = options.nxCloudId;

  // TODO(lourw): Update message with NxCloudId once it is supported
  if (!accessToken && !nxCloudId) {
    throw new Error(
      `Unable to authenticate. Either define accessToken in nx.json or set the NX_CLOUD_ACCESS_TOKEN env variable. If you do not want to use Nx Cloud for this command, either set NX_NO_CLOUD=true, or pass the --no-cloud flag.`
    );
  }

  if (options.customProxyConfigPath) {
    const { nxCloudProxyConfig } = require(join(
      process.cwd(),
      options.customProxyConfigPath
    ));
    axiosConfigBuilder = nxCloudProxyConfig ?? axiosConfigBuilder;
  }

  return axios.create(
    axiosConfigBuilder({
      baseURL: baseUrl,
      timeout: NX_CLOUD_NO_TIMEOUTS ? UNLIMITED_TIMEOUT : 10000,
      headers: { authorization: accessToken },
    })
  );
}
