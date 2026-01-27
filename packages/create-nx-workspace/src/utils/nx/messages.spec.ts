import { getCompletionMessage, getSkippedCloudMessage } from './messages';
import { VcsPushStatus } from '../git/git';

describe('Nx Cloud Messages', () => {
  describe('CI Setup Messages', () => {
    it('should show the setup link user pushed but is not coming from Nx Cloud', () => {
      const message = getCompletionMessage(
        'ci-setup',
        'https://nx.app/setup/123',
        VcsPushStatus.PushedToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Go to Nx Cloud and finish the setup: https://nx.app/setup/123",
          ],
          "title": "Your CI setup is almost complete.",
        }
      `);
    });

    it('should instruct the user to return to Nx Cloud when they have pushed the repo without instructing them to push', () => {
      const message = getCompletionMessage(
        'ci-setup',
        null,
        VcsPushStatus.PushedToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Return to Nx Cloud and finish the setup.",
          ],
          "title": "Your CI setup is almost complete.",
        }
      `);
    });

    it('should instruct user to push repo first when they opted out of pushing', () => {
      const message = getCompletionMessage(
        'ci-setup',
        'https://nx.app/setup/123',
        VcsPushStatus.OptedOutOfPushingToVcs,
        'myworkspace'
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new?name=myworkspace), then go to Nx Cloud and finish the setup: https://nx.app/setup/123",
          ],
          "title": "Your CI setup is almost complete.",
        }
      `);
    });

    it('should instruct user to go to Nx Cloud after pushing when they have failed to push and URL is available', () => {
      const message = getCompletionMessage(
        'ci-setup',
        'https://nx.app/setup/123',
        VcsPushStatus.FailedToPushToVcs,
        'myworkspace'
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new?name=myworkspace), then go to Nx Cloud and finish the setup: https://nx.app/setup/123",
          ],
          "title": "Your CI setup is almost complete.",
        }
      `);
    });

    it('should show "return to Nx Cloud" when failed to push and no URL', () => {
      const message = getCompletionMessage(
        'ci-setup',
        null,
        VcsPushStatus.FailedToPushToVcs,
        'myworkspace'
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new?name=myworkspace), then return to Nx Cloud and finish the setup.",
          ],
          "title": "Your CI setup is almost complete.",
        }
      `);
    });

    it('should show "return to Nx Cloud" when opted out and no URL', () => {
      const message = getCompletionMessage(
        'ci-setup',
        null,
        VcsPushStatus.OptedOutOfPushingToVcs,
        'myworkspace'
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new?name=myworkspace), then return to Nx Cloud and finish the setup.",
          ],
          "title": "Your CI setup is almost complete.",
        }
      `);
    });

    it('should use generic GitHub URL when workspaceName is not provided', () => {
      const message = getCompletionMessage(
        'ci-setup',
        'https://nx.app/setup/123',
        VcsPushStatus.FailedToPushToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new), then go to Nx Cloud and finish the setup: https://nx.app/setup/123",
          ],
          "title": "Your CI setup is almost complete.",
        }
      `);
    });
  });

  describe('Cache Setup Messages', () => {
    it('should show the setup link when user pushed but is not coming from Nx Cloud', () => {
      const message = getCompletionMessage(
        'cache-setup',
        'https://nx.app/setup/456',
        VcsPushStatus.PushedToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Go to Nx Cloud and finish the setup: https://nx.app/setup/456",
          ],
          "title": "Your remote cache setup is almost complete.",
        }
      `);
    });

    it('should instruct the user to return to Nx Cloud when they have pushed the repo without instructing them to push', () => {
      const message = getCompletionMessage(
        'cache-setup',
        null,
        VcsPushStatus.PushedToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Return to Nx Cloud and finish the setup.",
          ],
          "title": "Your remote cache setup is almost complete.",
        }
      `);
    });

    it('should instruct user to push repo first when they opted out of pushing', () => {
      const message = getCompletionMessage(
        'cache-setup',
        'https://nx.app/setup/456',
        VcsPushStatus.OptedOutOfPushingToVcs,
        'myworkspace'
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new?name=myworkspace), then go to Nx Cloud and finish the setup: https://nx.app/setup/456",
          ],
          "title": "Your remote cache setup is almost complete.",
        }
      `);
    });

    it('should instruct user to go to Nx Cloud after pushing when they have failed to push and URL is available', () => {
      const message = getCompletionMessage(
        'cache-setup',
        'https://nx.app/setup/456',
        VcsPushStatus.FailedToPushToVcs,
        'myworkspace'
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new?name=myworkspace), then go to Nx Cloud and finish the setup: https://nx.app/setup/456",
          ],
          "title": "Your remote cache setup is almost complete.",
        }
      `);
    });

    it('should instruct user to return to Nx Cloud after pushing when they have failed to push and no URL is available', () => {
      const message = getCompletionMessage(
        'cache-setup',
        null,
        VcsPushStatus.FailedToPushToVcs,
        'myworkspace'
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new?name=myworkspace), then return to Nx Cloud and finish the setup.",
          ],
          "title": "Your remote cache setup is almost complete.",
        }
      `);
    });

    it('should show "return to Nx Cloud" when opted out and no URL', () => {
      const message = getCompletionMessage(
        'cache-setup',
        null,
        VcsPushStatus.OptedOutOfPushingToVcs,
        'myworkspace'
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new?name=myworkspace), then return to Nx Cloud and finish the setup.",
          ],
          "title": "Your remote cache setup is almost complete.",
        }
      `);
    });

    it('should always include exactly one body line for cache setup messages', () => {
      const messageWithUrl = getCompletionMessage(
        'cache-setup',
        'https://nx.app/setup/456',
        VcsPushStatus.PushedToVcs
      );
      const messageWithoutUrl = getCompletionMessage(
        'cache-setup',
        null,
        VcsPushStatus.PushedToVcs
      );
      const messageNotPushedWithUrl = getCompletionMessage(
        'cache-setup',
        'https://nx.app/setup/456',
        VcsPushStatus.FailedToPushToVcs,
        'myworkspace'
      );
      const messageNotPushedWithoutUrl = getCompletionMessage(
        'cache-setup',
        null,
        VcsPushStatus.FailedToPushToVcs,
        'myworkspace'
      );

      expect(messageWithUrl.bodyLines).toHaveLength(1);
      expect(messageWithoutUrl.bodyLines).toHaveLength(1);
      expect(messageNotPushedWithUrl.bodyLines).toHaveLength(1);
      expect(messageNotPushedWithoutUrl.bodyLines).toHaveLength(1);
    });

    it('should have consistent title and type across all cache setup scenarios', () => {
      const scenarios = [
        { url: 'https://nx.app/setup/456', pushed: VcsPushStatus.PushedToVcs },
        { url: null, pushed: VcsPushStatus.PushedToVcs },
        {
          url: 'https://nx.app/setup/456',
          pushed: VcsPushStatus.FailedToPushToVcs,
        },
        { url: null, pushed: VcsPushStatus.FailedToPushToVcs },
        {
          url: 'https://nx.app/setup/456',
          pushed: VcsPushStatus.OptedOutOfPushingToVcs,
        },
        { url: null, pushed: VcsPushStatus.OptedOutOfPushingToVcs },
      ];

      scenarios.forEach(({ url, pushed }) => {
        const message = getCompletionMessage(
          'cache-setup',
          url,
          pushed,
          'myworkspace'
        );
        expect(message.title).toBe(
          'Your remote cache setup is almost complete.'
        );
      });
    });
  });

  describe('Platform Setup Messages', () => {
    it('should show platform setup title', () => {
      const message = getCompletionMessage(
        'platform-setup',
        'https://nx.app/setup/789',
        VcsPushStatus.PushedToVcs
      );
      expect(message.title).toBe('Your platform setup is almost complete.');
    });
  });

  describe('Platform Promo Messages', () => {
    it('should show promo title and subtext when user has pushed', () => {
      const message = getCompletionMessage(
        'platform-promo',
        'https://nx.app/setup/123',
        VcsPushStatus.PushedToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Connect your repo to enable remote caching and self-healing CI at: https://nx.app/setup/123",
            "",
            "Remote caching · Self-healing CI · Task distribution",
          ],
          "title": "Want faster builds?",
        }
      `);
    });

    it('should show promo message with generic cloud URL when pushed without URL', () => {
      const message = getCompletionMessage(
        'platform-promo',
        null,
        VcsPushStatus.PushedToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Connect your repo at https://cloud.nx.app to enable remote caching and self-healing CI.",
            "",
            "Remote caching · Self-healing CI · Task distribution",
          ],
          "title": "Want faster builds?",
        }
      `);
    });

    it('should instruct user to push repo first when they opted out of pushing', () => {
      const message = getCompletionMessage(
        'platform-promo',
        'https://nx.app/setup/123',
        VcsPushStatus.OptedOutOfPushingToVcs,
        'myworkspace'
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Connect your repo (https://github.com/new?name=myworkspace) to enable remote caching and self-healing CI at: https://nx.app/setup/123",
            "",
            "Remote caching · Self-healing CI · Task distribution",
          ],
          "title": "Want faster builds?",
        }
      `);
    });

    it('should show connect message with cloud URL when failed to push and no URL', () => {
      const message = getCompletionMessage(
        'platform-promo',
        null,
        VcsPushStatus.FailedToPushToVcs,
        'myworkspace'
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Connect your repo (https://github.com/new?name=myworkspace) to enable remote caching and self-healing CI at https://cloud.nx.app",
            "",
            "Remote caching · Self-healing CI · Task distribution",
          ],
          "title": "Want faster builds?",
        }
      `);
    });

    it('should use generic GitHub URL when workspaceName is not provided', () => {
      const message = getCompletionMessage(
        'platform-promo',
        'https://nx.app/setup/123',
        VcsPushStatus.FailedToPushToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Connect your repo (https://github.com/new) to enable remote caching and self-healing CI at: https://nx.app/setup/123",
            "",
            "Remote caching · Self-healing CI · Task distribution",
          ],
          "title": "Want faster builds?",
        }
      `);
    });

    it('should always include subtext in body lines', () => {
      const scenarios = [
        { url: 'https://nx.app/setup/123', pushed: VcsPushStatus.PushedToVcs },
        { url: null, pushed: VcsPushStatus.PushedToVcs },
        {
          url: 'https://nx.app/setup/123',
          pushed: VcsPushStatus.FailedToPushToVcs,
        },
        { url: null, pushed: VcsPushStatus.FailedToPushToVcs },
        {
          url: 'https://nx.app/setup/123',
          pushed: VcsPushStatus.OptedOutOfPushingToVcs,
        },
        { url: null, pushed: VcsPushStatus.OptedOutOfPushingToVcs },
      ];

      scenarios.forEach(({ url, pushed }) => {
        const message = getCompletionMessage(
          'platform-promo',
          url,
          pushed,
          'myworkspace'
        );
        expect(message.title).toBe('Want faster builds?');
        expect(message.bodyLines).toHaveLength(3);
        expect(message.bodyLines[1]).toBe('');
        expect(message.bodyLines[2]).toBe(
          'Remote caching \u00b7 Self-healing CI \u00b7 Task distribution'
        );
      });
    });
  });

  describe('Default Messages', () => {
    it('should default to ci-setup when no key is provided', () => {
      const message = getCompletionMessage(
        undefined,
        'https://nx.app/setup/123',
        VcsPushStatus.PushedToVcs
      );
      expect(message.title).toBe('Your CI setup is almost complete.');
    });
  });

  describe('Skipped Cloud Messages', () => {
    it('should return next steps message with nx connect instruction', () => {
      const message = getSkippedCloudMessage();
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Run "nx connect" to enable remote caching and speed up your CI.",
            "",
            "70% faster CI, 60% less compute, automatically fix broken PRs.",
            "Learn more at https://nx.dev/nx-cloud",
          ],
          "title": "Next steps",
        }
      `);
    });
  });
});
