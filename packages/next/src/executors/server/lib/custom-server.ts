import { joinPathFragments } from '@nrwl/devkit';
import next from 'next';
import { NextServerOptions, ProxyConfig } from '../../../utils/types';
import { tsNodeRegister } from './tsnode-register';

export function customServer(
  settings: NextServerOptions,
  proxyConfig?: ProxyConfig
): Promise<void> {
  const nextApp = next(settings);

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
