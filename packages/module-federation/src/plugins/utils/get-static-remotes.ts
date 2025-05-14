import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';
import { StaticRemoteConfig } from '../../utils';
import { DevRemoteFindOptions } from '../models';

export async function getStaticRemotes(
  remotesConfig: Record<string, StaticRemoteConfig>,
  devRemoteFindOptions?: DevRemoteFindOptions
) {
  const remotes = Object.keys(remotesConfig);
  const findStaticRemotesPromises: Promise<string | undefined>[] = [];
  for (const remote of remotes) {
    findStaticRemotesPromises.push(
      new Promise<string>((resolve, reject) => {
        waitForPortOpen(remotesConfig[remote].port, {
          retries: devRemoteFindOptions?.retries ?? 3,
          retryDelay: devRemoteFindOptions?.retryDelay ?? 1000,
        }).then(
          (res) => {
            resolve(undefined);
          },
          (rej) => {
            resolve(remote);
          }
        );
      })
    );
  }
  const staticRemoteNames = (
    await Promise.all(findStaticRemotesPromises)
  ).filter(Boolean);
  let staticRemotesConfig: Record<string, StaticRemoteConfig> = {};
  for (const remote of staticRemoteNames) {
    staticRemotesConfig[remote] = remotesConfig[remote];
  }
  return staticRemotesConfig;
}
