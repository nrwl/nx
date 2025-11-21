#### Replace Removed Matcher Aliases

Replaces removed Jest matcher aliases in test files with their corresponding matchers to align with Jest v30 changes. Read more at the [Jest v30 migration notes](https://jestjs.io/docs/upgrading-to-jest30#jest-expect--matchers).

#### Examples

{% tabs %}
{% tab label="Before" %}

```typescript {% fileName="apps/myapp/src/app.spec.ts" %}
describe('test', () => {
  it('should pass', async () => {
    expect(mockFn).toBeCalled();
    expect(mockFn).toBeCalledTimes(1);
    expect(mockFn).toBeCalledWith(arg);
    expect(mockFn).lastCalledWith(arg);
    expect(mockFn).nthCalledWith(1, arg);
    expect(mockFn).toReturn();
    expect(mockFn).toReturnTimes(1);
    expect(mockFn).toReturnWith(value);
    expect(mockFn).lastReturnedWith(value);
    expect(mockFn).nthReturnedWith(1, value);
    expect(() => someFn()).toThrowError();
    expect(() => someFn()).not.toThrowError();
    await expect(someAsyncFn()).rejects.toThrowError();
    await expect(someAsyncFn()).resolves.not.toThrowError();
  });
});
```

{% /tab %}

{% tab label="After" %}

```typescript {% fileName="apps/myapp/src/app.spec.ts" %}
describe('test', () => {
  it('should pass', async () => {
    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(arg);
    expect(mockFn).toHaveBeenLastCalledWith(arg);
    expect(mockFn).toHaveBeenNthCalledWith(1, arg);
    expect(mockFn).toHaveReturned();
    expect(mockFn).toHaveReturnedTimes(1);
    expect(mockFn).toHaveReturnedWith(value);
    expect(mockFn).toHaveLastReturnedWith(value);
    expect(mockFn).toHaveNthReturnedWith(1, value);
    expect(() => someFn()).toThrow();
    expect(() => someFn()).not.toThrow();
    await expect(someAsyncFn()).rejects.toThrow();
    await expect(someAsyncFn()).resolves.not.toThrow();
  });
});
```

{% /tab %}
{% /tabs %}
