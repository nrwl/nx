import { readFileSync } from 'fs';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { join } from 'path';
import {
  getVersionPlansForFixedGroup,
  getVersionPlansForIndependentGroup,
} from './version-plans';

describe('version-plans', () => {
  let tempFs: TempFs;

  beforeAll(async () => {
    tempFs = new TempFs('parse-version-plans');

    await tempFs.createFiles({
      '.nx/version-plans/plan1.md': readFileSync(
        join(__dirname, 'test-files/version-plan-1.md'),
        'utf-8'
      ),
      '.nx/version-plans/plan2.md': readFileSync(
        join(__dirname, 'test-files/version-plan-2.md'),
        'utf-8'
      ),
      '.nx/version-plans/plan3.md': readFileSync(
        join(__dirname, 'test-files/version-plan-3.md'),
        'utf-8'
      ),
      '.nx/version-plans/plan4.md': readFileSync(
        join(__dirname, 'test-files/version-plan-4.md'),
        'utf-8'
      ),
      '.nx/version-plans/plan5.md': readFileSync(
        join(__dirname, 'test-files/version-plan-5.md'),
        'utf-8'
      ),
      '.nx/version-plans/plan6.md': readFileSync(
        join(__dirname, 'test-files/version-plan-6.md'),
        'utf-8'
      ),
    });
  });

  afterAll(() => {
    tempFs.cleanup();
  });

  describe('getVersionPlansForFixedGroup', () => {
    it('should return all version plans for the specified group', async () => {
      const versionPlans = await getVersionPlansForFixedGroup('fixed-group-1');

      expect(versionPlans).toEqual([
        {
          filePath: expect.stringContaining('plan5.md'),
          groupVersionBump: 'minor',
          message: 'This is a change to fixed-group-1',
        },
        {
          filePath: expect.stringContaining('plan6.md'),
          groupVersionBump: 'major',
          message: 'This is a major change to fixed-group-1',
        },
      ]);
    });

    it("should not return plans where the provided group name isn't the first line in the frontmatter header", async () => {
      const versionPlans = await getVersionPlansForFixedGroup(
        'ignored-group-1'
      );

      expect(versionPlans).toEqual([]);
    });

    it('should not return independent-style plans for the provided group', async () => {
      const versionPlans = await getVersionPlansForFixedGroup(
        'independent-group-1'
      );

      expect(versionPlans).toEqual([]);
    });
  });
  describe('getVersionPlansForIndependentGroup', () => {
    it('should return all version plans for the specified group name and the provided projects.', async () => {
      const versionPlans = await getVersionPlansForIndependentGroup(
        'independent-group-1',
        ['pkg1', 'pkg2']
      );

      expect(versionPlans).toEqual([
        {
          filePath: expect.stringContaining('plan1.md'),
          projectVersionBumps: {
            pkg1: 'patch',
          },
          message:
            'This is a change to just package 1 within independent-group-1',
        },
        {
          filePath: expect.stringContaining('plan2.md'),
          projectVersionBumps: {
            pkg1: 'minor',
            pkg2: 'patch',
          },
          message:
            'This is a change to package 1 and package 2 within independent-group-1',
        },
      ]);
    });

    it('should return all version plans for the specified group and ignore extra entries', async () => {
      const versionPlans = await getVersionPlansForIndependentGroup(
        'independent-group-2',
        ['pkg3', 'pkg4', 'pkg5', 'pkg6']
      );

      expect(versionPlans).toEqual([
        {
          filePath: expect.stringContaining('plan3.md'),
          projectVersionBumps: {
            pkg3: 'major',
            pkg4: 'minor',
          },
          message:
            'This is a change to packages 3 and 4 within independent-group',
        },
        {
          filePath: expect.stringContaining('plan4.md'),
          projectVersionBumps: {
            pkg3: 'patch',
            pkg4: 'minor',
            pkg5: 'prerelease',
            pkg6: 'preminor',
          },
          message:
            'This is a change to packages 3, 4, 5, and 6 within independent-group-2',
        },
      ]);
    });

    it('should not return fixed-style plans for the provided group', async () => {
      const versionPlans = await getVersionPlansForIndependentGroup(
        'fixed-group-1',
        ['ignored-package-1']
      );

      expect(versionPlans).toEqual([]);
    });

    it("should not return plans where the group name isn't the first line in the frontmatter header", async () => {
      const versionPlans = await getVersionPlansForIndependentGroup(
        'ignored-group-1',
        ['ignored-package-1', 'pkg6']
      );

      expect(versionPlans).toEqual([]);
    });
  });
});
