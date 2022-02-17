import { VersionMetadata } from '@nrwl/nx-dev/data-access-documents';
import { createContext, ReactNode, useContext } from 'react';

interface VersionsAndFlavorsContextValue {
  versions: VersionMetadata[];
  activeVersion: VersionMetadata;
  isFallbackActiveFlavor?: boolean;
}

const VersionsContext = createContext<null | VersionsAndFlavorsContextValue>(
  null
);

const missingErrorMessage =
  'Context not found. Did you include <VersionsProvider> in your app?';

export function useVersions(): VersionMetadata[] {
  const ctx = useContext(VersionsContext);
  if (!ctx) throw new Error(missingErrorMessage);
  return ctx.versions;
}

export function useActiveVersion(): VersionMetadata {
  const ctx = useContext(VersionsContext);
  if (!ctx) throw new Error(missingErrorMessage);
  return ctx.activeVersion;
}

export function VersionsAndFlavorsProvider(props: {
  value: VersionsAndFlavorsContextValue;
  children: ReactNode;
}) {
  return (
    <VersionsContext.Provider value={props.value}>
      {props.children}
    </VersionsContext.Provider>
  );
}
