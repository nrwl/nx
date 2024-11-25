import { readJsonFile } from '@nx/devkit';
import {
  replaceTargeGroupNameWithOptions,
  replaceTargetNameWithOptions,
} from './create-ci-targets';
import { join } from 'path';

describe('create ci targets', () => {
  describe('replaceTargetNameWithOptions', () => {
    it('should replace target with ci target name', () => {
      const targets = replaceTargetNameWithOptions(
        {
          ci: {
            metadata: {
              nonAtomizedTarget: 'test',
            },
            dependsOn: [
              {
                target: 'ci-some-file',
              },
            ],
          },
        },
        {
          ciTargetName: 'test-ci',
          testTargetName: 'test',
        },
        '.'
      );
      expect(targets).toEqual({
        'test-ci': {
          metadata: {
            nonAtomizedTarget: 'test',
          },
          dependsOn: [
            {
              target: 'test-ci-some-file',
            },
          ],
          options: {
            __unparsed__: [],
            cwd: '.',
          },
        },
      });
    });

    it('should not add ci target name if options.ciTargetName is not specified', () => {
      const targets = replaceTargetNameWithOptions(
        {
          ci: {
            metadata: {
              nonAtomizedTarget: 'test',
            },
            dependsOn: [
              {
                target: 'test-ci',
              },
            ],
          },
        },
        {},
        '.'
      );
      expect(targets).toEqual({});
    });

    it('should replace test in dependsOn with ci target name', () => {
      const isCi = process.env.CI;
      process.env.CI = 'true';
      const graldeListNodes = readJsonFile(
        join(__dirname, '__mocks__/gradle_nx_list.json')
      );
      const targets = graldeListNodes.targets;
      expect(
        replaceTargetNameWithOptions(targets, { ciTargetName: 'test-ci' }, '.')
      ).toMatchSnapshot();
      process.env.CI = isCi;
    });

    it('should not replace test in dependsOn with ci target name if process.env.CI is false', () => {
      const isCi = process.env.CI;
      process.env.CI = 'false';
      const graldeListNodes = readJsonFile(
        join(__dirname, '__mocks__/gradle_nx_list.json')
      );
      const targets = graldeListNodes.targets;
      expect(
        replaceTargetNameWithOptions(targets, { ciTargetName: 'test-ci' }, '.')
      ).toMatchSnapshot();
      process.env.CI = isCi;
    });
  });

  describe('replaceTargeGroupNameWithOptions', () => {
    it('should replace target in target group with ci target name', () => {
      const targetGroups = replaceTargeGroupNameWithOptions(
        {
          verification: ['ci', 'ci-test-file'],
        },
        {
          ciTargetName: 'test-ci',
        }
      );
      expect(targetGroups).toEqual({
        verification: ['test-ci', 'test-ci-test-file'],
      });
    });

    it('should not replace target in target group with ci target name if options.ciTargetName is not specified', () => {
      const targetGroups = replaceTargeGroupNameWithOptions(
        {
          verification: ['ci', 'ci-test-file'],
        },
        {}
      );
      expect(targetGroups).toEqual({
        verification: ['ci', 'ci-test-file'],
      });
    });
  });
});
