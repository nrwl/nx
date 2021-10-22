import {
  useActiveFlavor,
  useActiveVersion,
  useFlavors,
  useVersions,
} from '@nrwl/nx-dev/feature-versions-and-flavors';
import { pathCleaner } from '@nrwl/nx-dev/feature-flavor-selection';
import { useStorage } from '@nrwl/nx-dev/feature-storage';
import { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';
import { FlavorMetadata } from '@nrwl/nx-dev/data-access-documents';

export function useSelectedFlavor() {
  const versions = useVersions();
  const flavors = useFlavors();
  const activeFlavor = useActiveFlavor();
  const activeVersion = useActiveVersion();
  const cleanPath = pathCleaner(versions, flavors);
  const { value: selectedFlavor, setValue: setSelectedFlavor } =
    useStorage('flavor');
  const router = useRouter();
  const handleSetFlavor = (f: FlavorMetadata) => setSelectedFlavor(f.alias);

  const flavorSelected = useMemo(
    () => !(activeFlavor.isFallback && !selectedFlavor) && !!selectedFlavor,
    [activeFlavor.isFallback, selectedFlavor]
  );

  useEffect(() => {
    if (!activeFlavor.isFallback || !selectedFlavor) return;

    // If the selected flavor is different then, navigate away.
    // Otherwise, replace current URL _if_ it is missing version+flavor.
    if (activeFlavor.alias !== selectedFlavor) {
      router.replace(
        `/${activeVersion.alias}/${selectedFlavor}${cleanPath(router.asPath)}`
      );
    } else if (!router.asPath.startsWith(`/${activeVersion.alias}`)) {
      router.replace(
        `/${activeVersion.alias}/${selectedFlavor}${cleanPath(router.asPath)}`
      );
    }
  }, [router, activeVersion, activeFlavor, selectedFlavor]);

  return {
    selectedFlavor,
    setSelectedFlavor: handleSetFlavor,
    flavorSelected,
  };
}
