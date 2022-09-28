import { mapLockFileDataToExternalNodes } from './lock-file';
import { LockFileData } from './lock-file-type';

describe('lock-file', () => {
  describe('mapLockFileDataToExternalNodes', () => {
    it('should map lock file data to external nodes', () => {
      const lockFileData: LockFileData = {
        dependencies: {
          'happy-nrwl': {
            'happy-nrwl@1.0.0': {
              version: '1.0.0',
              resolved:
                'https://registry.npmjs.org/happy-nrwl/-/happy-nrwl-1.0.0.tgz',
              integrity: 'sha512-1',
              packageMeta: ['happy-nrwl@1.0.0'],
            },
          },
          'happy-nrwl2': {
            'happy-nrwl2@^1.0.0': {
              version: '1.2.0',
              resolved:
                'https://registry.npmjs.org/happy-nrwl2/-/happy-nrwl2-1.2.0.tgz',
              integrity: 'sha512-2',
              packageMeta: ['happy-nrwl@^1.0.0'],
            },
          },
        },
      };
      const externalNodes = mapLockFileDataToExternalNodes(lockFileData);
      expect(externalNodes).toEqual({
        'npm:happy-nrwl': {
          type: 'npm',
          name: 'npm:happy-nrwl',
          data: {
            version: '1.0.0',
            resolved:
              'https://registry.npmjs.org/happy-nrwl/-/happy-nrwl-1.0.0.tgz',
            integrity: 'sha512-1',
          },
        },
        'npm:happy-nrwl2': {
          type: 'npm',
          name: 'npm:happy-nrwl2',
          data: {
            version: '1.2.0',
            resolved:
              'https://registry.npmjs.org/happy-nrwl2/-/happy-nrwl2-1.2.0.tgz',
            integrity: 'sha512-2',
          },
        },
      });
    });
  });
});
