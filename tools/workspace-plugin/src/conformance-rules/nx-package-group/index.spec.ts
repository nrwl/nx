import { validatePackageGroupMembership } from './index';

describe('nx-package-group', () => {
  describe('validatePackageGroupMembership()', () => {
    const nxPackageJsonPath = '/root/packages/nx/package.json';
    const packageGroup = new Set(['@nx/foo', '@nx/bar']);

    it('should not report a package listed in the group', () => {
      const violations = validatePackageGroupMembership(
        { name: '@nx/foo' },
        'foo',
        nxPackageJsonPath,
        packageGroup
      );

      expect(violations).toHaveLength(0);
    });

    it('should not report private packages', () => {
      const violations = validatePackageGroupMembership(
        { name: '@nx/internal-tool', private: true },
        'internal-tool',
        nxPackageJsonPath,
        packageGroup
      );

      expect(violations).toHaveLength(0);
    });

    it('should not report packages outside the @nx scope', () => {
      for (const name of ['nx', 'create-nx-plugin', 'create-nx-workspace']) {
        const violations = validatePackageGroupMembership(
          { name },
          name,
          nxPackageJsonPath,
          packageGroup
        );

        expect(violations).toHaveLength(0);
      }
    });

    it('should not report packages without a name', () => {
      const violations = validatePackageGroupMembership(
        {},
        'unnamed',
        nxPackageJsonPath,
        packageGroup
      );

      expect(violations).toHaveLength(0);
    });

    it('should report a published @nx/* package missing from the group', () => {
      const violations = validatePackageGroupMembership(
        { name: '@nx/baz' },
        'baz',
        nxPackageJsonPath,
        packageGroup
      );

      expect(violations).toMatchInlineSnapshot(`
        [
          {
            "file": "/root/packages/nx/package.json",
            "message": "@nx/baz is missing from the "nx-migrations".packageGroup in packages/nx/package.json, so "nx migrate" will not update it together with the other Nx packages. Add it to the group.",
            "sourceProject": "baz",
          },
        ]
      `);
    });
  });
});
