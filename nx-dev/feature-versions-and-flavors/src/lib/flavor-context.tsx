import * as React from 'react';
import {
  FlavorMetadata,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';

interface VersionsAndFlavorsContextValue {
  versions: VersionMetadata[];
  activeVersion: VersionMetadata;
  flavors: FlavorMetadata[];
  activeFlavor: FlavorMetadata;
  isFallbackActiveFlavor?: boolean;
}

const VersionsAndFlavorsContext =
  React.createContext<null | VersionsAndFlavorsContextValue>(null);

const missingErrorMessage =
  'Context not found. Did you include <VersionsAndFlavorsProvider> in your app?';

export function useVersions(): VersionMetadata[] {
  const ctx = React.useContext(VersionsAndFlavorsContext);
  if (!ctx) throw new Error(missingErrorMessage);
  return ctx.versions;
}

export function useFlavors(): FlavorMetadata[] {
  const ctx = React.useContext(VersionsAndFlavorsContext);
  if (!ctx) throw new Error(missingErrorMessage);
  return ctx.flavors;
}

export function useActiveFlavor(): FlavorMetadata & {
  isFallback: boolean;
} {
  const ctx = React.useContext(VersionsAndFlavorsContext);
  if (!ctx) throw new Error(missingErrorMessage);
  return { ...ctx.activeFlavor, isFallback: !!ctx.isFallbackActiveFlavor };
}

export function useActiveVersion(): VersionMetadata {
  const ctx = React.useContext(VersionsAndFlavorsContext);
  if (!ctx) throw new Error(missingErrorMessage);
  return ctx.activeVersion;
}

export function VersionsAndFlavorsProvider(props: {
  value: VersionsAndFlavorsContextValue;
  children: React.ReactNode;
}) {
  return (
    <VersionsAndFlavorsContext.Provider value={props.value}>
      {props.children}
    </VersionsAndFlavorsContext.Provider>
  );
}
