import { render } from '@testing-library/react';

import PluginCard from './plugin-card';

describe('PluginCard', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <PluginCard
        name={'my plugin'}
        description={'some description'}
        url={'nx.dev'}
      />
    );
    expect(baseElement).toBeTruthy();
  });
});
