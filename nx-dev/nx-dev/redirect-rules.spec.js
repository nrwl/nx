import redirectRules from './redirect-rules';

describe('Redirect rules configuration', () => {
  describe('Safety checks', () => {
    it('should not redirect to itself', () => {
      const allRules = {};
      for (const section of Object.keys(redirectRules)) {
        Object.assign(allRules, redirectRules[section]);
      }

      for (const k of Object.keys(allRules)) {
        expect(k).not.toEqual(allRules[k]);
      }
    });

    it('should not have empty destinations', () => {
      for (const section of Object.keys(redirectRules)) {
        for (const [source, dest] of Object.entries(redirectRules[section])) {
          expect(dest).toBeTruthy();
        }
      }
    });
  });

  describe('Tutorial redirects', () => {
    test('react tutorial wildcard covers old step URLs', () => {
      // Individual react tutorial step URLs are now handled by
      // '/react-tutorial/:path*' -> '/docs/getting-started/tutorials/react-monorepo-tutorial'
      expect(redirectRules.tutorialRedirects['/react-tutorial/:path*']).toEqual(
        '/docs/getting-started/tutorials/react-monorepo-tutorial'
      );
    });

    test('angular tutorial wildcard covers old step URLs', () => {
      // Individual angular tutorial step URLs are now handled by
      // '/angular-tutorial/:path*' -> '/docs/getting-started/tutorials/angular-monorepo-tutorial'
      expect(
        redirectRules.tutorialRedirects['/angular-tutorial/:path*']
      ).toEqual('/docs/getting-started/tutorials/angular-monorepo-tutorial');
    });

    test('old integrated-repo tutorial link', () => {
      expect(
        redirectRules.nested5minuteTutorialUrls[
          '/tutorials/integrated-repo-tutorial'
        ]
      ).toEqual('/docs/getting-started/tutorials/react-monorepo-tutorial');
    });
  });

  describe('Wildcard consolidation', () => {
    test('cli wildcard exists', () => {
      expect(redirectRules.cliUrls['/cli/:path*']).toEqual(
        '/docs/reference/nx-commands'
      );
    });

    test('concept wildcard exists in docsToAstroRedirects', () => {
      expect(redirectRules.docsToAstroRedirects['/concepts/:path*']).toEqual(
        '/docs/concepts/:path*'
      );
    });
  });
});
