import redirectRules from './redirect-rules';

describe('Redirect rules configuration', () => {
  describe('Safety checks', () => {
    it('should not redirect to itself', () => {
      const rules = {
        ...redirectRules.cliUrls,
        ...redirectRules.diataxis,
        ...redirectRules.guideUrls,
        ...redirectRules.overviewUrls,
        ...redirectRules.schemaUrls,
        ...redirectRules.tutorialRedirects,
      };

      for (let k of Object.keys(rules)) {
        expect(k).not.toEqual(rules[k]);
      }
    });
  });

  describe('Tutorial redirects', () => {
    test('old tutorial links', () => {
      const oldReactUrls = [
        '/react-tutorial/01-create-application',
        '/react-tutorial/02-add-e2e-test',
        '/react-tutorial/03-display-todos',
        '/react-tutorial/04-connect-to-api',
        '/react-tutorial/05-add-node-app',
        '/react-tutorial/06-proxy',
        '/react-tutorial/07-share-code',
        '/react-tutorial/08-create-libs',
        '/react-tutorial/09-dep-graph',
        '/react-tutorial/10-computation-caching',
        '/react-tutorial/11-test-affected-projects',
        '/react-tutorial/12-summary',
      ];

      for (const url of oldReactUrls) {
        expect(redirectRules.tutorialRedirects[url]).toEqual(
          '/react-tutorial/1-code-generation'
        );
      }
    });

    test('old angular tutorial links', () => {
      const oldAngularUrls = [
        '/angular-tutorial/01-create-application',
        '/angular-tutorial/02-add-e2e-test',
        '/angular-tutorial/03-display-todos',
        '/angular-tutorial/04-connect-to-api',
        '/angular-tutorial/05-add-node-app',
        '/angular-tutorial/06-proxy',
        '/angular-tutorial/07-share-code',
        '/angular-tutorial/08-create-libs',
        '/angular-tutorial/09-dep-graph',
        '/angular-tutorial/10-computation-caching',
        '/angular-tutorial/11-test-affected-projects',
        '/angular-tutorial/12-summary',
      ];

      for (const url of oldAngularUrls) {
        expect(redirectRules.tutorialRedirects[url]).toEqual(
          '/angular-tutorial/1-code-generation'
        );
      }
    });

    test('old tutorial links', () => {
      const oldTutorialUrls = [
        '/tutorials/package-based-repo-tutorial',
        '/tutorials/integrated-repo-tutorial',
        '/tutorials/react-standalone-tutorial',
        '/tutorials/angular-standalone-tutorial',
      ];

      for (const url of oldTutorialUrls) {
        expect(redirectRules.nested5minuteTutorialUrls[url]).toEqual(
          '/getting-started' + url
        );
      }
    });
  });
});
