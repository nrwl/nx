import React from 'react';
import { screen } from '@testing-library/dom';
import { render } from '@testing-library/react';

import Sidebar from './sidebar';

describe('Sidebar', () => {
  it('should render sections', () => {
    render(
      <Sidebar
        menu={{
          version: 'preview',
          flavor: 'react',
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
                    { id: 'a', name: 'A', path: '/a' },
                    { id: 'b', name: 'B', path: '/b' },
                    { id: 'c', name: 'C', path: '/c' },
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
                    { id: 'd', name: 'D', path: '/d' },
                    { id: 'e', name: 'E', path: '/e' },
                  ],
                },
              ],
            },
          ],
        }}
        flavor={{ label: 'Angular', value: 'angular' }}
        flavorList={[
          { label: 'Angular', value: 'angular' },
          { label: 'React', value: 'react' },
        ]}
        version={{
          name: 'Latest (v11.4.0)',
          id: 'latest',
          release: '11.4.0',
          path: '11.4.0',
          default: true,
        }}
        versionList={[
          {
            name: 'Latest (v11.4.0)',
            id: 'latest',
            release: '11.4.0',
            path: '11.4.0',
            default: true,
          },
          {
            name: 'Previous (v10.4.13)',
            id: 'previous',
            release: '10.4.13',
            path: '10.4.13',
            default: false,
          },
        ]}
      />
    );

    expect(() => screen.getByTestId('section-h4:basic')).toThrow(
      /Unable to find/
    );
    expect(screen.getByTestId('section-h4:api')).toBeTruthy();
  });
});
