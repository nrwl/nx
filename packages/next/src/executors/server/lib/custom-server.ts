import { joinPathFragments } from '@nrwl/devkit';
import NextServer from 'next/dist/server/next-dev-server';
import { NextServerOptions, ProxyConfig } from '../../../utils/types';
import { tsNodeRegister } from './tsnode-register';

export function customServer(
  settings: NextServerOptions,
  proxyConfig?: ProxyConfig
): Promise<void> {
  const nextApp = new NextServer(settings);

  tsNodeRegister(
    joinPathFragments(settings.dir, settings.path),
    joinPathFragments(settings.dir, 'tsconfig.json')
  );

  const customServerModule = require(joinPathFragments(
    settings.dir,
    settings.path
  ));
  const customServer = customServerModule.default || customServerModule;
  return customServer(nextApp, settings, proxyConfig);
}
