import { getMessageFactory } from './messages';

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
        true
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
      const message = messageFactory.createMessage(null, true);
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

    it('should instruct user to go to Nx Cloud after pushing when they have not pushed and URL is available', () => {
      const message = messageFactory.createMessage(
        'https://nx.app/setup/123',
        false
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Once you have pushed your repo, go to Nx Cloud and finish the setup: https://nx.app/setup/123",
          ],
          "title": "Your CI setup is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should show "return to Nx Cloud" when not pushed and no URL', () => {
      const message = messageFactory.createMessage(null, false);
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Once you have pushed your repo, return to Nx Cloud and finish the setup",
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
        true
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Go to Nx Cloud and finish the setup: https://nx.app/setup/456",
            "You can also set up a remote cache later by running \`nx g @nx/nx-cloud:init\`",
          ],
          "title": "Your remote cache is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should instruct the user to return to Nx Cloud when they have pushed the repo without instructing them to push', () => {
      const message = messageFactory.createMessage(null, true);
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Return to Nx Cloud and finish the setup",
            "You can also set up a remote cache later by running \`nx g @nx/nx-cloud:init\`",
          ],
          "title": "Your remote cache is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should instruct user to go to Nx Cloud after pushing when they have not pushed and URL is available', () => {
      const message = messageFactory.createMessage(
        'https://nx.app/setup/456',
        false
      );
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Once you have pushed your repo, go to Nx Cloud and finish the setup: https://nx.app/setup/456",
            "You can also set up a remote cache later by running \`nx g @nx/nx-cloud:init\`",
          ],
          "title": "Your remote cache is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should instruct user to return to Nx Cloud after pushing when they have not pushed and no URL is available', () => {
      const message = messageFactory.createMessage(null, false);
      expect(message).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "Once you have pushed your repo, return to Nx Cloud and finish the setup",
            "You can also set up a remote cache later by running \`nx g @nx/nx-cloud:init\`",
          ],
          "title": "Your remote cache is almost complete.",
          "type": "success",
        }
      `);
    });

    it('should always include the additional setup command for alternative installation', () => {
      const message = messageFactory.createMessage(
        'https://nx.app/setup/456',
        true
      );
      expect(message.bodyLines).toContain(
        'You can also set up a remote cache later by running `nx g @nx/nx-cloud:init`'
      );
    });

    it('should always include exactly two body lines for cache setup messages', () => {
      const messageWithUrl = messageFactory.createMessage(
        'https://nx.app/setup/456',
        true
      );
      const messageWithoutUrl = messageFactory.createMessage(null, true);
      const messageNotPushedWithUrl = messageFactory.createMessage(
        'https://nx.app/setup/456',
        false
      );
      const messageNotPushedWithoutUrl = messageFactory.createMessage(
        null,
        false
      );

      expect(messageWithUrl.bodyLines).toHaveLength(2);
      expect(messageWithoutUrl.bodyLines).toHaveLength(2);
      expect(messageNotPushedWithUrl.bodyLines).toHaveLength(2);
      expect(messageNotPushedWithoutUrl.bodyLines).toHaveLength(2);
    });

    it('should have consistent title and type across all cache setup scenarios', () => {
      const scenarios = [
        { url: 'https://nx.app/setup/456', pushed: true },
        { url: null, pushed: true },
        { url: 'https://nx.app/setup/456', pushed: false },
        { url: null, pushed: false },
      ];

      scenarios.forEach(({ url, pushed }) => {
        const message = messageFactory.createMessage(url, pushed);
        expect(message.title).toBe('Your remote cache is almost complete.');
        expect(message.type).toBe('success');
      });
    });
  });

  describe('Message Structure', () => {
    it('should return consistent message structure for CI setup', () => {
      const messageFactory = getMessageFactory(
        'create-nx-workspace-success-ci-setup'
      );
      const message = messageFactory.createMessage(
        'https://nx.app/setup/123',
        true
      );

      expect(message).toHaveProperty('title');
      expect(message).toHaveProperty('type', 'success');
      expect(message).toHaveProperty('bodyLines');
      expect(Array.isArray(message.bodyLines)).toBe(true);
    });

    it('should return consistent message structure for cache setup', () => {
      const messageFactory = getMessageFactory(
        'create-nx-workspace-success-cache-setup'
      );
      const message = messageFactory.createMessage(
        'https://nx.app/setup/456',
        true
      );

      expect(message).toHaveProperty('title');
      expect(message).toHaveProperty('type', 'success');
      expect(message).toHaveProperty('bodyLines');
      expect(Array.isArray(message.bodyLines)).toBe(true);
      expect(message.bodyLines).toHaveLength(2);
    });
  });
});
