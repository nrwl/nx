import { withReact } from './with-react';

describe('removed withReact stub', () => {
  it('preserves user config without applying webpack or React defaults', () => {
    const config = Object.freeze({ mode: 'production' as const });
    expect(withReact()(config)).toBe(config);
  });
});
