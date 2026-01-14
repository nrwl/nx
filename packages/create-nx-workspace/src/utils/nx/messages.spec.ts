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
        VcsPushStatus.OptedOutOfPushingToVcs
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

    it('should instruct user to go to Nx Cloud after pushing when they have failed to push and URL is available', () => {
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

    it('should show "return to Nx Cloud" when failed to push and no URL', () => {
      const message = getCompletionMessage(
        'ci-setup',
        null,
        VcsPushStatus.FailedToPushToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new), then return to Nx Cloud and finish the setup.",
          ],
          "title": "Your CI setup is almost complete.",
        }
      `);
    });

    it('should show "return to Nx Cloud" when opted out and no URL', () => {
      const message = getCompletionMessage(
        'ci-setup',
        null,
        VcsPushStatus.OptedOutOfPushingToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new), then return to Nx Cloud and finish the setup.",
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
        VcsPushStatus.OptedOutOfPushingToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new), then go to Nx Cloud and finish the setup: https://nx.app/setup/456",
          ],
          "title": "Your remote cache setup is almost complete.",
        }
      `);
    });

    it('should instruct user to go to Nx Cloud after pushing when they have failed to push and URL is available', () => {
      const message = getCompletionMessage(
        'cache-setup',
        'https://nx.app/setup/456',
        VcsPushStatus.FailedToPushToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new), then go to Nx Cloud and finish the setup: https://nx.app/setup/456",
          ],
          "title": "Your remote cache setup is almost complete.",
        }
      `);
    });

    it('should instruct user to return to Nx Cloud after pushing when they have failed to push and no URL is available', () => {
      const message = getCompletionMessage(
        'cache-setup',
        null,
        VcsPushStatus.FailedToPushToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new), then return to Nx Cloud and finish the setup.",
          ],
          "title": "Your remote cache setup is almost complete.",
        }
      `);
    });

    it('should show "return to Nx Cloud" when opted out and no URL', () => {
      const message = getCompletionMessage(
        'cache-setup',
        null,
        VcsPushStatus.OptedOutOfPushingToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo (https://github.com/new), then return to Nx Cloud and finish the setup.",
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
        VcsPushStatus.FailedToPushToVcs
      );
      const messageNotPushedWithoutUrl = getCompletionMessage(
        'cache-setup',
        null,
        VcsPushStatus.FailedToPushToVcs
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
        const message = getCompletionMessage('cache-setup', url, pushed);
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
