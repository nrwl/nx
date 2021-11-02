import { act, renderHook } from '@testing-library/react-hooks';
import { VersionsAndFlavorsProvider } from '@nrwl/nx-dev/feature-versions-and-flavors';
import { useSelectedFlavor } from './use-selected-flavor';
import { FlavorMetadata } from '@nrwl/nx-dev/data-access-documents';
import { NextRouter, useRouter } from 'next/router';

jest.mock('next/router', () => {
  const router = {
    asPath: '/getting-started/intro',
    replace: () => null,
  };
  return { useRouter: () => router };
});

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

const mockFlavors: FlavorMetadata[] = [
  { id: 'angular', name: 'Angular', alias: 'a', path: 'angular' },
  {
    id: 'react',
    name: 'React',
    alias: 'r',
    path: 'react',
    default: true,
  },
  { id: 'node', name: 'Node', alias: 'n', path: 'node' },
];

const latestVersion = {
  name: 'Latest',
  id: 'latest',
  alias: 'l',
  release: 'master',
  path: 'latest',
  default: true,
};

function createWrapper(opts: { activeAlias: string; isFallback: boolean }) {
  return function Wrapper(props: any) {
    return (
      <VersionsAndFlavorsProvider
        value={{
          flavors: mockFlavors,
          versions: [latestVersion],
          activeFlavor: getFlavor(opts),
          activeVersion: latestVersion,
          isFallbackActiveFlavor: opts.isFallback,
        }}
      >
        {props.children}
      </VersionsAndFlavorsProvider>
    );
  };
}

function getFlavor(opts: { activeAlias: string }) {
  return mockFlavors.find(
    (f) => f.alias === opts.activeAlias
  ) as FlavorMetadata;
}

describe('useSelectedFlavor', () => {
  let router: NextRouter;
  let replaceSpy: jest.SpyInstance;
  let mockStorage: MockStorage;

  beforeAll(() => {
    router = useRouter();
    replaceSpy = jest.spyOn(router, 'replace');
    mockStorage = new MockStorage();
    Object.defineProperty(window, 'localStorage', { value: mockStorage });
  });

  afterEach(() => {
    replaceSpy.mockReset();
    mockStorage.clear();
  });

  it('should store flavor in storage when `setSelectedFlavor` is called', () => {
    router.asPath = '/getting-started/intro';
    const { result } = renderHook(() => useSelectedFlavor(), {
      wrapper: createWrapper({ activeAlias: 'a', isFallback: true }),
    });

    act(() =>
      result.current.setSelectedFlavor(getFlavor({ activeAlias: 'r' }))
    );

    expect(mockStorage.getItem('flavor')).toEqual('r');

    act(() =>
      result.current.setSelectedFlavor(getFlavor({ activeAlias: 'n' }))
    );

    expect(mockStorage.getItem('flavor')).toEqual('n');
  });

  it('should redirect when active and selected flavors are different', () => {
    router.asPath = '/l/a/getting-started/intro';
    const { result } = renderHook(() => useSelectedFlavor(), {
      wrapper: createWrapper({ activeAlias: 'a', isFallback: true }),
    });

    act(() =>
      result.current.setSelectedFlavor(getFlavor({ activeAlias: 'r' }))
    );

    expect(router.replace).toHaveBeenCalledWith('/l/r/getting-started/intro');
  });

  it('should not redirect when selected and active flavors are the same', () => {
    router.asPath = '/l/r/getting-started/intro';
    const { result } = renderHook(() => useSelectedFlavor(), {
      wrapper: createWrapper({ activeAlias: 'r', isFallback: true }),
    });

    act(() =>
      result.current.setSelectedFlavor(getFlavor({ activeAlias: 'r' }))
    );

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('should redirect when URL is a fallback URL', () => {
    router.asPath = '/getting-started/intro';
    const { result } = renderHook(() => useSelectedFlavor(), {
      wrapper: createWrapper({ activeAlias: 'a', isFallback: true }),
    });

    act(() =>
      result.current.setSelectedFlavor(getFlavor({ activeAlias: 'a' }))
    );

    expect(router.replace).toHaveBeenCalledWith('/l/a/getting-started/intro');
  });

  it('should not redirect when URL is not fallback URL', () => {
    router.asPath = '/l/r/getting-started/intro';
    const { result } = renderHook(() => useSelectedFlavor(), {
      wrapper: createWrapper({ activeAlias: 'r', isFallback: false }),
    });

    act(() =>
      result.current.setSelectedFlavor(getFlavor({ activeAlias: 'r' }))
    );

    expect(router.replace).not.toHaveBeenCalled();
  });
});
