import React from 'react';
import { screen } from '@testing-library/dom';
import { render } from '@testing-library/react';

import Sidebar from './sidebar';

describe('Sidebar', () => {
  it('should render sections', () => {
    render(
      <Sidebar
        navIsOpen={false}
        menu={{
          sections: [
            {
              id: 'basic',
              name: 'Basic',
              hideSectionHeader: true,
              itemList: [
                {
                  id: 'getting-started',
                  name: 'getting started',
                  itemList: [
                    { id: 'a', name: 'A', path: '/a', url: '/a' },
                    { id: 'b', name: 'B', path: '/b', url: '/b' },
                    { id: 'c', name: 'C', path: '/c', url: '/c' },
                  ],
                },
              ],
            },
            {
              id: 'api',
              name: 'API',
              itemList: [
                {
                  id: 'overview',
                  name: 'overview',
                  itemList: [
                    { id: 'd', name: 'D', path: '/d', url: '/d' },
                    { id: 'e', name: 'E', path: '/e', url: '/e' },
                  ],
                },
              ],
            },
          ],
        }}
      />
    );

    // TODO: figure out the type errors and fix
    // @ts-ignore
    expect(() => screen.getByTestId('section-h4:basic')).toThrow(
      /Unable to find/
    );
    // @ts-ignore
    expect(screen.getByTestId('section-h4:api')).toBeTruthy();
  });
});
