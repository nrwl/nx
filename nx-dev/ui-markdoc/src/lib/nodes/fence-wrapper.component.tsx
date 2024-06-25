'use client';
import { Fence, FenceProps } from '@nx/nx-dev/ui-fence';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const useUrlHash = (initialValue: string) => {
  const [hash, setHash] = useState(initialValue);

  const updateHash = (str: string) => {
    if (!str) return;
    setHash(str.split('#')[1]);
  };

  const params = useParams();

  useEffect(() => {
    updateHash(window.location.hash);
  }, [params]);

  return hash;
};

export function FenceWrapper(props: FenceProps) {
  const { push } = useRouter();
  const pathName = usePathname();
  const hash = decodeURIComponent(useUrlHash(''));

  const modifiedProps: FenceProps = {
    ...props,
    selectedLineGroup: hash,
    onLineGroupSelectionChange: (selection: string) => {
      push(pathName.split('#')[0] + '#' + selection);
    },
  };

  return (
    <div className="my-8 w-full">
      <Fence {...modifiedProps} />
    </div>
  );
}
