import NextServer from 'next/dist/server/next-dev-server';
import * as path from 'path';
import { NextServerOptions, ProxyConfig } from '../../../utils/types';

export function customServer(
  settings: NextServerOptions,
  proxyConfig?: ProxyConfig
) {
  const nextApp = new NextServer(settings);

  return require(path.resolve(settings.dir, settings.path))(
    nextApp,
    settings,
    proxyConfig
  );
}
