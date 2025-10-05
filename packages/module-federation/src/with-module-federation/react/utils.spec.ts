import { applyDefaultEagerPackages } from './utils';
import { SharedLibraryConfig } from '../../utils';

describe('React utils', () => {
  describe('applyDefaultEagerPackages', () => {
    it('should mark React packages as eager', () => {
      const sharedConfig: Record<string, SharedLibraryConfig> = {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^6.0.0' },
        'react-router': { singleton: true, requiredVersion: '^6.0.0' },
        lodash: { singleton: true, requiredVersion: '^4.0.0' },
      };

      applyDefaultEagerPackages(sharedConfig);

      expect(sharedConfig['react']).toEqual({
        singleton: true,
        requiredVersion: '^18.0.0',
        eager: true,
      });
      expect(sharedConfig['react-dom']).toEqual({
        singleton: true,
        requiredVersion: '^18.0.0',
        eager: true,
      });
      expect(sharedConfig['react-router-dom']).toEqual({
        singleton: true,
        requiredVersion: '^6.0.0',
        eager: true,
      });
      expect(sharedConfig['react-router']).toEqual({
        singleton: true,
        requiredVersion: '^6.0.0',
        eager: true,
      });
      expect(sharedConfig['lodash']).toEqual({
        singleton: true,
        requiredVersion: '^4.0.0',
      });
    });

    it('should skip packages that are not in shared config', () => {
      const sharedConfig: Record<string, SharedLibraryConfig> = {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        lodash: { singleton: true, requiredVersion: '^4.0.0' },
      };

      applyDefaultEagerPackages(sharedConfig);

      expect(sharedConfig['react']).toEqual({
        singleton: true,
        requiredVersion: '^18.0.0',
        eager: true,
      });
      expect(sharedConfig['lodash']).toEqual({
        singleton: true,
        requiredVersion: '^4.0.0',
      });
      expect(sharedConfig['react-dom']).toBeUndefined();
      expect(sharedConfig['react-router-dom']).toBeUndefined();
    });

    it('should not modify existing eager settings', () => {
      const sharedConfig: Record<string, SharedLibraryConfig> = {
        react: { singleton: true, requiredVersion: '^18.0.0', eager: false },
        'react-dom': {
          singleton: true,
          requiredVersion: '^18.0.0',
          eager: false,
        },
      };

      applyDefaultEagerPackages(sharedConfig);

      expect(sharedConfig['react']).toEqual({
        singleton: true,
        requiredVersion: '^18.0.0',
        eager: true,
      });
      expect(sharedConfig['react-dom']).toEqual({
        singleton: true,
        requiredVersion: '^18.0.0',
        eager: true,
      });
    });

    it('should work with empty shared config', () => {
      const sharedConfig: Record<string, SharedLibraryConfig> = {};

      expect(() => applyDefaultEagerPackages(sharedConfig)).not.toThrow();
      expect(sharedConfig).toEqual({});
    });
  });
});
