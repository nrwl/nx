import { names } from './names';

describe('names', () => {
  it('should support class names', () => {
    expect(names('foo-bar').className).toEqual('FooBar');
    expect(names('foo_bar').className).toEqual('FooBar');
    expect(names('fooBar').className).toEqual('FooBar');
    expect(names('FooBar').className).toEqual('FooBar');
    expect(names('[fooBar]').className).toEqual('FooBar');
    expect(names('[...fooBar]').className).toEqual('FooBar');
    expect(names('foo-@bar').className).toEqual('FooBar');
    expect(names(' foo bar').className).toEqual('FooBar');
    expect(names('_foo_bar').className).toEqual('FooBar');
  });

  it('should support property names', () => {
    expect(names('foo-bar').propertyName).toEqual('fooBar');
    expect(names('foo_bar').propertyName).toEqual('fooBar');
    expect(names('fooBar').propertyName).toEqual('fooBar');
    expect(names('FooBar').propertyName).toEqual('fooBar');
    expect(names('[fooBar]').propertyName).toEqual('fooBar');
    expect(names('[...fooBar]').propertyName).toEqual('fooBar');
    expect(names('foo-@bar').propertyName).toEqual('fooBar');
    expect(names(' foo bar').propertyName).toEqual('fooBar');
    expect(names('_foo_bar').propertyName).toEqual('fooBar');
  });

  it('should support file names', () => {
    expect(names('foo-bar').fileName).toEqual('foo-bar');
    expect(names('foo_bar').fileName).toEqual('foo-bar');
    expect(names('fooBar').fileName).toEqual('foo-bar');
    expect(names('FooBar').fileName).toEqual('foo-bar');
    expect(names('[fooBar]').fileName).toEqual('[foo-bar]');
    expect(names('[...fooBar]').fileName).toEqual('[...foo-bar]');
    expect(names('foo-@bar').fileName).toEqual('foo-@bar');
    expect(names(' foo bar').fileName).toEqual('-foo-bar');
    expect(names('_foo_bar').fileName).toEqual('_foo-bar');
  });

  it('should support constant names', () => {
    expect(names('foo-bar').constantName).toEqual('FOO_BAR');
    expect(names('foo_bar').constantName).toEqual('FOO_BAR');
    expect(names('fooBar').constantName).toEqual('FOO_BAR');
    expect(names('FooBar').constantName).toEqual('FOO_BAR');
    expect(names('[fooBar]').constantName).toEqual('FOO_BAR');
    expect(names('[...fooBar]').constantName).toEqual('FOO_BAR');
    expect(names('foo-@bar').constantName).toEqual('FOO_BAR');
    expect(names(' foo bar').constantName).toEqual('FOO_BAR');
    expect(names('_foo_bar').constantName).toEqual('FOO_BAR');
    expect(names('FOO_BAR').constantName).toEqual('FOO_BAR');
  });

  it('should support non-ASCII names', () => {
    expect(names('Écran').className).toEqual('Écran');
    expect(names('Écran').propertyName).toEqual('écran');
    expect(names('Écran').constantName).toEqual('ÉCRAN');
    expect(names('café-menu').className).toEqual('CaféMenu');
    expect(names('café-menu').propertyName).toEqual('caféMenu');
    expect(names('café-menu').constantName).toEqual('CAFÉ_MENU');
    expect(names('меню').className).toEqual('Меню');
    expect(names('меню').propertyName).toEqual('меню');
    expect(names('меню').constantName).toEqual('МЕНЮ');
  });

  it('should not split leading acronyms in constant names', () => {
    expect(names('HTTPServer').constantName).toEqual('HTTP_SERVER');
    expect(names('APIClient').constantName).toEqual('API_CLIENT');
  });
});
