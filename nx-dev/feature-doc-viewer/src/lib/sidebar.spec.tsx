import React from 'react';
import { screen } from '@testing-library/dom';
import { render } from '@testing-library/react';

import Sidebar, { createNextPath } from './sidebar';
import { VersionsAndFlavorsProvider } from '@nrwl/nx-dev/feature-versions-and-flavors';

describe('Sidebar', () => {
  it('should render sections', () => {
    render(
      <VersionsAndFlavorsProvider
        value={{
          activeFlavor: {
            id: 'angular',
            name: 'Angular',
            alias: 'a',
            path: 'angular',
          },
          activeVersion: {
            name: 'Latest',
            id: 'latest',
            alias: 'l',
            release: '12.9.0',
            path: 'latest',
            default: true,
          },
          flavors: [
            {
              id: 'angular',
              name: 'Angular',
              alias: 'a',
              path: 'angular',
            },
            {
              id: 'react',
              name: 'React',
              alias: 'r',
              path: 'react',
              default: true,
            },
          ],
          versions: [
            {
              name: 'Latest',
              id: 'latest',
              alias: 'l',
              release: '12.9.0',
              path: 'latest',
              default: true,
            },
            {
              name: 'Previous (v10.4.13)',
              id: 'previous',
              alias: 'p',
              release: '10.4.13',
              path: '10.4.13',
              default: false,
            },
          ],
        }}
      >
        <Sidebar
          navIsOpen={false}
          menu={{
            version: {
              name: 'Latest',
              id: 'latest',
              alias: 'l',
              release: '12.9.0',
              path: 'latest',
              default: true,
            },
            flavor: {
              id: 'angular',
              name: 'Angular',
              alias: 'a',
              path: 'angular',
            },
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
      </VersionsAndFlavorsProvider>
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

describe('createNextPath', () => {
  it('should replace version and flavor in the current path', () => {
    expect(
      createNextPath('latest', 'react', '/previous/react/guides/eslint')
    ).toEqual('/latest/react/guides/eslint');

    expect(
      createNextPath('previous', 'angular', '/previous/react/guides/eslint')
    ).toEqual('/previous/angular/guides/eslint');
  });
});
