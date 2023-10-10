import { getComponentClassName } from './utils';

describe('getComponentClassName', () => {
  it('should return correct component name if no directory and isApp', () => {
    expect(getComponentClassName('HelloWorld', true, 'main-app')).toEqual(
      'AppHelloWorld'
    );
  });

  it('should return correct component name if no directory and isApp is false', () => {
    expect(
      getComponentClassName('HelloWorld', false, 'my-shared-feature')
    ).toEqual('MySharedFeatureHelloWorld');
  });

  it('should return correct component name if directory provided - case 1', () => {
    expect(
      getComponentClassName('HelloWorld', false, 'my-other-lib', 'ui/feat')
    ).toEqual('UiFeatHelloWorld');
  });

  it('should return correct component name if directory provided - case 2', () => {
    expect(
      getComponentClassName('Hello', false, 'my-other-lib', 'ui/feat/other')
    ).toEqual('UiFeatOtherHello');
  });

  it('should return correct component name if directory provided - case 3', () => {
    expect(getComponentClassName('Hello', true, 'my-other-lib', 'ui')).toEqual(
      'UiHello'
    );
  });
});
