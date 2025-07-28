import { getMessageFactory } from './messages';
import { VcsPushStatus } from '../git/git';

describe('Nx Cloud Messages', () => {
  describe('CI Setup Messages', () => {
    let messageFactory: ReturnType<typeof getMessageFactory>;
    beforeEach(() => {
      messageFactory = getMessageFactory(
        'create-nx-workspace-success-ci-setup'
      );
    });

    it('should show the setup link user pushed but is not coming from Nx Cloud', () => {
      const message = messageFactory.createMessage(
        'https://nx.app/setup/123',
        VcsPushStatus.PushedToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Go to Nx Cloud and finish the setup: https://nx.app/setup/123",
          ],
          "title": "Your CI setup is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should instruct the user to return to Nx Cloud when they have pushed the repo without instructing them to push', () => {
      const message = messageFactory.createMessage(
        null,
        VcsPushStatus.PushedToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Return to Nx Cloud and finish the setup",
          ],
          "title": "Your CI setup is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should instruct user to push repo first when they opted out of pushing', () => {
      const message = messageFactory.createMessage(
        'https://nx.app/setup/123',
        VcsPushStatus.OptedOutOfPushingToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo, then go to Nx Cloud and finish the setup: https://nx.app/setup/123",
          ],
          "title": "Your CI setup is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should instruct user to go to Nx Cloud after pushing when they have failed to push and URL is available', () => {
      const message = messageFactory.createMessage(
        'https://nx.app/setup/123',
        VcsPushStatus.FailedToPushToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo, then go to Nx Cloud and finish the setup: https://nx.app/setup/123",
          ],
          "title": "Your CI setup is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should show "return to Nx Cloud" when failed to push and no URL', () => {
      const message = messageFactory.createMessage(
        null,
        VcsPushStatus.FailedToPushToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo, then return to Nx Cloud and finish the setup",
          ],
          "title": "Your CI setup is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should show "return to Nx Cloud" when opted out and no URL', () => {
      const message = messageFactory.createMessage(
        null,
        VcsPushStatus.OptedOutOfPushingToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo, then return to Nx Cloud and finish the setup",
          ],
          "title": "Your CI setup is almost complete.",
          "type": "success",
        }
      `);
    });
  });

  describe('Cache Setup Messages', () => {
    let messageFactory: ReturnType<typeof getMessageFactory>;
    beforeEach(() => {
      messageFactory = getMessageFactory(
        'create-nx-workspace-success-cache-setup'
      );
    });

    it('should show the setup link when user pushed but is not coming from Nx Cloud', () => {
      const message = messageFactory.createMessage(
        'https://nx.app/setup/456',
        VcsPushStatus.PushedToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Go to Nx Cloud and finish the setup: https://nx.app/setup/456",
          ],
          "title": "Your remote cache is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should instruct the user to return to Nx Cloud when they have pushed the repo without instructing them to push', () => {
      const message = messageFactory.createMessage(
        null,
        VcsPushStatus.PushedToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Return to Nx Cloud and finish the setup",
          ],
          "title": "Your remote cache is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should instruct user to push repo first when they opted out of pushing', () => {
      const message = messageFactory.createMessage(
        'https://nx.app/setup/456',
        VcsPushStatus.OptedOutOfPushingToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo, then go to Nx Cloud and finish the setup: https://nx.app/setup/456",
          ],
          "title": "Your remote cache is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should instruct user to go to Nx Cloud after pushing when they have failed to push and URL is available', () => {
      const message = messageFactory.createMessage(
        'https://nx.app/setup/456',
        VcsPushStatus.FailedToPushToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo, then go to Nx Cloud and finish the setup: https://nx.app/setup/456",
          ],
          "title": "Your remote cache is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should instruct user to return to Nx Cloud after pushing when they have failed to push and no URL is available', () => {
      const message = messageFactory.createMessage(
        null,
        VcsPushStatus.FailedToPushToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo, then return to Nx Cloud and finish the setup",
          ],
          "title": "Your remote cache is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should show "return to Nx Cloud" when opted out and no URL', () => {
      const message = messageFactory.createMessage(
        null,
        VcsPushStatus.OptedOutOfPushingToVcs
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Push your repo, then return to Nx Cloud and finish the setup",
          ],
          "title": "Your remote cache is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should always include exactly two body lines for cache setup messages', () => {
      const messageWithUrl = messageFactory.createMessage(
        'https://nx.app/setup/456',
        VcsPushStatus.PushedToVcs
      );
      const messageWithoutUrl = messageFactory.createMessage(
        null,
        VcsPushStatus.PushedToVcs
      );
      const messageNotPushedWithUrl = messageFactory.createMessage(
        'https://nx.app/setup/456',
        VcsPushStatus.FailedToPushToVcs
      );
      const messageNotPushedWithoutUrl = messageFactory.createMessage(
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
        const message = messageFactory.createMessage(url, pushed);
        expect(message.title).toBe('Your remote cache is almost complete.');
        expect(message.type).toBe('success');
      });
    });
  });
});
