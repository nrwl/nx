import { AxiosRequestConfig } from 'axios';
import { join } from 'path';
import { CloudTaskRunnerOptions } from '../core/models/cloud-task-runner-options';
import {
  ACCESS_TOKEN,
  NUMBER_OF_AXIOS_RETRIES,
  NX_CLOUD_NO_TIMEOUTS,
  UNLIMITED_TIMEOUT,
  VERBOSE_LOGGING,
} from './environment';
import { wait } from './waiter';

const { output } = require('./nx-imports-light');

const axios = require('axios');

export class AxiosException {
  constructor(
    public readonly type: 'timeout' | 'failure',
    public readonly message: string,
    public readonly axiosException: any
  ) {}
}

export function createApiAxiosInstance(options: CloudTaskRunnerOptions) {
  let axiosConfigBuilder = (axiosConfig: AxiosRequestConfig) => axiosConfig;
  const baseUrl =
    process.env.NX_CLOUD_API || options.url || 'https://cloud.nx.app';
  const accessToken = ACCESS_TOKEN ? ACCESS_TOKEN : options.accessToken!;

  if (!accessToken) {
    throw new Error(
      `Unable to authenticate. Either define accessToken in nx.json or set the NX_CLOUD_ACCESS_TOKEN env variable.`
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

export async function printDuration(description: string, callback: Function) {
  const b = new Date();
  const res = await callback();
  const a = new Date();

  if (VERBOSE_LOGGING) {
    console.log(`${description}: ${a.getTime() - b.getTime()}`);
  }

  return res;
}

let error429Promise: Promise<unknown> | null = null;

export async function axiosMultipleTries(
  axiosCallCreator: () => Promise<any>,
  retriesLeft = NUMBER_OF_AXIOS_RETRIES
) {
  try {
    return await axiosCallCreator();
  } catch (e: any) {
    const code = (e.response && e.response.status) || e.code;

    // Do not retry if we receive an unauthorized or forbidden response
    if (code === 401 || code === 403) {
      retriesLeft = 0;
    }
    let message = e.response
      ? e.response.data.message
        ? e.response.data.message
        : e.response.data
      : e.message;
    if (retriesLeft === 0) {
      if (typeof message !== 'string') {
        message = e.message;
      }
      throw new AxiosException(
        'failure',
        `Error when connecting to Nx Cloud. Code: ${code}. Error: ${message}`,
        e
      );
    } else {
      if (code == 429) {
        // this logic helps us not print the same message over and over again
        if (!error429Promise) {
          const retryAfter =
            10000 +
            (NUMBER_OF_AXIOS_RETRIES + 1 - retriesLeft) * 60000 * Math.random();
          output.note({
            title: `Received Code ${code}. ${message} Retrying in ${retryAfter}ms.`,
          });
          error429Promise = wait(retryAfter);
        }
        await error429Promise;
        error429Promise = null;
      } else {
        const retryAfter =
          1000 +
          (NUMBER_OF_AXIOS_RETRIES + 1 - retriesLeft) * 4000 * Math.random();
        if (VERBOSE_LOGGING) {
          output.note({
            title: `Received Code ${code}. Retrying in ${retryAfter}ms.`,
          });
        }
        await wait(retryAfter);
      }
      return axiosMultipleTries(axiosCallCreator, retriesLeft - 1);
    }
  }
}
