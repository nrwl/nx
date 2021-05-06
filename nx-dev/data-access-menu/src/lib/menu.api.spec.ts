import { getMenu } from './menu.api';

describe('getMenu', () => {
  it('should group by section', () => {
    const menu = getMenu('preview', 'react');

    expect(menu).toEqual({
      version: 'preview',
      flavor: 'react',
      sections: expect.arrayContaining([
        expect.objectContaining({ id: 'basic', itemList: expect.any(Array) }),
        expect.objectContaining({ id: 'api', itemList: expect.any(Array) }),
        expect.objectContaining({
          id: 'deep-dive',
          itemList: expect.any(Array),
        }),
      ]),
    });
  });

  it('should add path to menu items', () => {
    const menu = getMenu('preview', 'react');

    // first basic section item should have prefix by version and flavor
    // e.g. "preview/react/getting-started/intro"
    expect(menu.sections[0].itemList[0].itemList[0].path).toMatch(
      /preview\/react/
    );
  });
});
