import { getDevServerConfig } from './devserver.config';
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import * as ts from 'typescript';
import * as fs from 'fs';
import { WebBuildBuilderOptions } from '../builders/build/build.impl';
import { WebDevServerOptions } from '../builders/dev-server/dev-server.impl';
import { join } from 'path';

jest.mock('tsconfig-paths-webpack-plugin');
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
import { logger } from '@nrwl/devkit';
jest.mock('opn');
import * as opn from 'opn';

describe('getDevServerConfig', () => {
  let buildInput: WebBuildBuilderOptions;
  let serveInput: WebDevServerOptions;
  let mockCompilerOptions: any;
  let root: string;
  let sourceRoot: string;

  beforeEach(() => {
    root = join(__dirname, '../../../..');
    sourceRoot = join(root, 'apps/app');
    buildInput = {
      main: 'main.ts',
      index: 'index.html',
      budgets: [],
      baseHref: '/',
      deployUrl: '/',
      sourceMap: {
        scripts: true,
        styles: true,
        hidden: false,
        vendors: false,
      },
      optimization: {
        scripts: false,
        styles: false,
      },
      styles: [],
      scripts: [],
      outputPath: 'dist',
      tsConfig: 'tsconfig.json',
      fileReplacements: [],
      root,
      sourceRoot,
    };

    serveInput = {
      host: 'localhost',
      port: 4200,
      buildTarget: 'webapp:build',
      ssl: false,
      liveReload: true,
      open: false,
      watch: true,
      allowedHosts: null,
    };

    (<any>(
      TsConfigPathsPlugin
    )).mockImplementation(function MockPathsPlugin() {});

    mockCompilerOptions = {
      target: 'es2015',
    };

    spyOn(ts, 'readConfigFile').and.callFake(() => ({
      config: {
        compilerOptions: mockCompilerOptions,
      },
    }));
  });

  describe('unconditional settings', () => {
    it('should allow requests from any domain', () => {
      const { devServer: result } = getDevServerConfig(
        root,
        sourceRoot,
        buildInput,
        serveInput
      ) as any;

      expect(result.headers['Access-Control-Allow-Origin']).toEqual('*');
    });

    it('should not display warnings in the overlay', () => {
      const { devServer: result } = getDevServerConfig(
        root,
        sourceRoot,
        buildInput,
        serveInput
      ) as any;

      expect(result.overlay.warnings).toEqual(false);
    });

    it('should not emit stats', () => {
      const { devServer: result } = getDevServerConfig(
        root,
        sourceRoot,
        buildInput,
        serveInput
      ) as any;

      expect(result.stats).toEqual(false);
    });

    it('should not have a contentBase', () => {
      const { devServer: result } = getDevServerConfig(
        root,
        sourceRoot,
        buildInput,
        serveInput
      ) as any;

      expect(result.contentBase).toEqual(false);
    });

    describe('onListening', () => {
      let mockServer;

      beforeEach(() => {
        mockServer = {
          options: {
            https: false,
          },
          hostname: 'example.com',
          listeningApp: {
            address: () => ({
              port: 9999,
            }),
          },
        };

        spyOn(logger, 'info');
        opn.mockImplementation(() => {});
      });

      it('should print out the URL of the server', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          buildInput,
          serveInput
        ) as any;

        result.onListening(mockServer);

        expect(logger.info).toHaveBeenCalledWith(
          jasmine.stringMatching(new RegExp('http://example.com:9999/'))
        );
      });

      it('should not open the url by default', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          buildInput,
          serveInput
        ) as any;

        result.onListening(mockServer);

        expect(opn).not.toHaveBeenCalled();
      });

      it('should open the url if --open is passed', () => {
        serveInput.open = true;
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          buildInput,
          serveInput
        ) as any;

        result.onListening(mockServer);

        expect(opn).toHaveBeenCalledWith('http://example.com:9999/', {
          wait: false,
        });
      });
    });
  });

  describe('host option', () => {
    it('should set the host option', () => {
      const { devServer: result } = getDevServerConfig(
        root,
        sourceRoot,
        buildInput,
        serveInput
      ) as any;

      expect(result.host).toEqual('localhost');
    });
  });

  describe('port option', () => {
    it('should set the port option', () => {
      const { devServer: result } = getDevServerConfig(
        root,
        sourceRoot,
        buildInput,
        serveInput
      ) as any;

      expect(result.port).toEqual(4200);
    });
  });

  describe('build options', () => {
    it('should set the history api fallback options', () => {
      const { devServer: result } = getDevServerConfig(
        root,
        sourceRoot,
        buildInput,
        serveInput
      ) as any;

      expect(result.historyApiFallback).toEqual({
        index: '//index.html',
        disableDotRule: true,
        htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
      });
    });

    describe('optimization', () => {
      it('should not compress assets by default', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          buildInput,
          serveInput
        ) as any;

        expect(result.compress).toEqual(false);
      });

      it('should compress assets if scripts optimization is on', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          {
            ...buildInput,
            optimization: {
              scripts: true,
              styles: false,
            },
          },
          serveInput
        ) as any;

        expect(result.compress).toEqual(true);
      });

      it('should compress assets if styles optimization is on', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          {
            ...buildInput,
            optimization: {
              scripts: false,
              styles: true,
            },
          },
          serveInput
        ) as any;

        expect(result.compress).toEqual(true);
      });

      it('should compress assets if all optimization is on', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          {
            ...buildInput,
            optimization: {
              scripts: true,
              styles: true,
            },
          },
          serveInput
        ) as any;

        expect(result.compress).toEqual(true);
      });

      it('should show an overlay when optimization is off', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          {
            ...buildInput,
            optimization: {
              scripts: false,
              styles: false,
            },
          },
          serveInput
        ) as any;

        expect(result.overlay.errors).toEqual(true);
      });

      it('should not show an overlay when optimization is on', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          {
            ...buildInput,
            optimization: {
              scripts: true,
              styles: true,
            },
          },
          serveInput
        ) as any;

        expect(result.overlay.errors).toEqual(false);
      });
    });

    describe('liveReload option', () => {
      it('should set the correct value', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          buildInput,
          serveInput
        );

        expect(result.liveReload).toEqual(true);
      });

      it('should set the correct if false', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          buildInput,
          { ...serveInput, liveReload: false }
        );

        expect(result.liveReload).toEqual(false);
      });
    });

    describe('ssl option', () => {
      it('should set https to false if not on', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          {
            ...buildInput,
            optimization: {
              scripts: true,
              styles: true,
            },
          },
          serveInput
        ) as any;

        expect(result.https).toEqual(false);
      });

      it('should configure it with the key and cert provided when on', () => {
        spyOn(fs, 'readFileSync').and.callFake((path) => {
          if (path.endsWith('ssl.key')) {
            return 'sslKeyContents';
          } else if (path.endsWith('ssl.cert')) {
            return 'sslCertContents';
          }
        });

        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          buildInput,
          {
            ...serveInput,
            ssl: true,
            sslKey: 'ssl.key',
            sslCert: 'ssl.cert',
          }
        ) as any;

        expect(result.https).toEqual({
          key: 'sslKeyContents',
          cert: 'sslCertContents',
        });
      });
    });

    describe('proxyConfig option', () => {
      it('should setProxyConfig', () => {
        jest.mock(
          join(root, 'proxy.conf'),
          () => ({
            proxyConfig: 'proxyConfig',
          }),
          {
            virtual: true,
          }
        );

        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          buildInput,
          {
            ...serveInput,
            proxyConfig: 'proxy.conf',
          }
        ) as any;

        expect(result.proxy).toEqual({
          proxyConfig: 'proxyConfig',
        });
      });
    });

    describe('allowed hosts', () => {
      it('should have two allowed hosts', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          buildInput,
          {
            ...serveInput,
            allowedHosts: 'host.com,subdomain.host.com',
          }
        ) as any;

        expect(result.allowedHosts).toEqual(['host.com', 'subdomain.host.com']);
      });

      it('should have one allowed host', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          buildInput,
          {
            ...serveInput,
            allowedHosts: 'host.com',
          }
        ) as any;

        expect(result.allowedHosts).toEqual(['host.com']);
      });

      it('should not have allowed hosts', () => {
        const { devServer: result } = getDevServerConfig(
          root,
          sourceRoot,
          buildInput,
          serveInput
        ) as any;

        expect(result.allowedHosts).toEqual([]);
      });

      describe('the max workers option', () => {
        it('should set the maximum workers for the type checker', () => {
          const result = getDevServerConfig(
            root,
            sourceRoot,
            { ...buildInput, maxWorkers: 1 },
            serveInput
          ) as any;

          const typeCheckerPlugin = result.plugins.find(
            (plugin) => plugin instanceof ForkTsCheckerWebpackPlugin
          ) as ForkTsCheckerWebpackPlugin;
          expect(typeCheckerPlugin.options.workers).toEqual(1);
        });
      });

      describe('the memory limit option', () => {
        it('should set the memory limit for the type checker', () => {
          const result = getDevServerConfig(
            root,
            sourceRoot,
            { ...buildInput, memoryLimit: 1024 },
            serveInput
          ) as any;

          const typeCheckerPlugin = result.plugins.find(
            (plugin) => plugin instanceof ForkTsCheckerWebpackPlugin
          ) as ForkTsCheckerWebpackPlugin;
          expect(typeCheckerPlugin.options.memoryLimit).toEqual(1024);
        });
      });
    });
  });
});
