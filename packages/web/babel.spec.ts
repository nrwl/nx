const babelPreset = require('./babel');

describe('@nrwl/web/babel preset', () => {
  it('should provide default plugin options', () => {
    const apiMock = {
      assertVersion: jest.fn(),
      caller: jest.fn(),
    };

    const options = babelPreset(apiMock);

    expect(
      findPluginOptions('@babel/plugin-proposal-decorators', options)
    ).toEqual({
      legacy: true,
    });

    expect(
      findPluginOptions('@babel/plugin-proposal-class-properties', options)
    ).toEqual({
      loose: true,
    });
  });

  it('should allow overrides of plugin options', () => {
    const apiMock = {
      assertVersion: jest.fn(),
      caller: jest.fn(),
    };

    const options = babelPreset(apiMock, {
      decorators: {
        decoratorsBeforeExport: true,
        legacy: false,
      },
      classProperties: {
        loose: false,
      },
    });

    expect(
      findPluginOptions('@babel/plugin-proposal-decorators', options)
    ).toEqual({
      decoratorsBeforeExport: true,
      legacy: false,
    });

    expect(
      findPluginOptions('@babel/plugin-proposal-class-properties', options)
    ).toEqual({
      loose: false,
    });
  });
});

function findPluginOptions(name: string, options: any) {
  return options.plugins.find(
    (x) => Array.isArray(x) && x[0].indexOf(name) !== -1
  )[1];
}
