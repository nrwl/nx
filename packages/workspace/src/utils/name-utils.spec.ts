import * as utils from './name-utils';

describe('name-utils', () => {
  it('should support class names', () => {
    expect(utils.toClassName('foo-bar')).toEqual('FooBar');
    expect(utils.toClassName('foo_bar')).toEqual('FooBar');
    expect(utils.toClassName('fooBar')).toEqual('FooBar');
    expect(utils.toClassName('[fooBar]')).toEqual('FooBar');
    expect(utils.toClassName('[...fooBar]')).toEqual('FooBar');
  });

  it('should support property names', () => {
    expect(utils.toPropertyName('foo-bar')).toEqual('fooBar');
    expect(utils.toPropertyName('foo_bar')).toEqual('fooBar');
    expect(utils.toPropertyName('FooBar')).toEqual('fooBar');
    expect(utils.toPropertyName('[fooBar]')).toEqual('fooBar');
    expect(utils.toPropertyName('[...fooBar]')).toEqual('fooBar');
  });

  it('should support file names', () => {
    expect(utils.toFileName('foo-bar')).toEqual('foo-bar');
    expect(utils.toFileName('foo_bar')).toEqual('foo-bar');
    expect(utils.toFileName('FooBar')).toEqual('foo-bar');
    expect(utils.toFileName('[fooBar]')).toEqual('[foo-bar]');
    expect(utils.toFileName('[...fooBar]')).toEqual('[...foo-bar]');
  });
});
