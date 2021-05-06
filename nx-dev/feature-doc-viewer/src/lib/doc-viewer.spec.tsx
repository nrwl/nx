import React from 'react';
import { render } from '@testing-library/react';

import DocViewer from './doc-viewer';

describe('DocViewer', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <DocViewer
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
        document={{ content: '', data: {}, excerpt: '', filePath: '' }}
        menu={{ version: 'preview', flavor: 'react', sections: [] }}
        toc=""
      />
    );
    expect(baseElement).toBeTruthy();
  });
});
