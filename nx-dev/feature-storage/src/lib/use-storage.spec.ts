import { act, renderHook } from '@testing-library/react-hooks';
import { useStorage } from './use-storage';

class MockStorage {
  private cache: Record<string, string> = {};
  getItem(key: string) {
    return this.cache[key];
  }
  setItem(key: string, value: string) {
    this.cache[key] = value;
  }
  clear() {
    this.cache = {};
  }
}

describe('useStorage', () => {
  let mockStorage: MockStorage;

  beforeAll(() => {
    mockStorage = new MockStorage();
    Object.defineProperty(window, 'localStorage', { value: mockStorage });
  });

  beforeEach(() => mockStorage.clear());

  it('should support setting new value', () => {
    const { result } = renderHook(() => useStorage('test'));

    act(() => result.current.setValue('new value'));

    expect(result.current.value).toEqual('new value');
    expect(mockStorage.getItem('test')).toEqual('new value');
  });

  it('should read initial value from storage', () => {
    mockStorage.setItem('test', 'initial');
    const { result } = renderHook(() => useStorage('test'));

    expect(result.current.value).toEqual('initial');
  });

  it('should use stored value as initial if it exists', () => {
    mockStorage.setItem('test', 'existing');
    const { result } = renderHook(() => useStorage('test'));

    expect(result.current.value).toEqual('existing');
  });
});
