import { Fence, FenceProps } from '@nx/nx-dev/ui-fence';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const useUrlHash = (initialValue: string) => {
  const router = useRouter();
  const [hash, setHash] = useState(initialValue);

  const updateHash = (str: string) => {
    if (!str) return;
    setHash(str.split('#')[1]);
  };

  useEffect(() => {
    const onWindowHashChange = () => updateHash(window.location.hash);
    const onNextJSHashChange = (url: string) => updateHash(url);

    router.events.on('hashChangeStart', onNextJSHashChange);
    window.addEventListener('hashchange', onWindowHashChange);
    window.addEventListener('load', onWindowHashChange);
    return () => {
      router.events.off('hashChangeStart', onNextJSHashChange);
      window.removeEventListener('load', onWindowHashChange);
      window.removeEventListener('hashchange', onWindowHashChange);
    };
  }, [router.asPath, router.events]);

  return hash;
};

export function FenceWrapper(props: FenceProps) {
  const { push, asPath } = useRouter();
  const hash = decodeURIComponent(useUrlHash(''));

  const modifiedProps: FenceProps = {
    ...props,
    selectedLineGroup: hash,
    onLineGroupSelectionChange: (selection: string) => {
      push(asPath.split('#')[0] + '#' + selection);
    },
  };
  return (
    <div className="my-8 w-full">
      <Fence {...modifiedProps} />
    </div>
  );
}
