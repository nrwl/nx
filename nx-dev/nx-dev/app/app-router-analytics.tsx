'use client';
import { sendPageViewEvent } from '@nx/nx-dev/feature-analytics';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AppRouterAnalytics({ gaMeasurementId }) {
  const pathName = usePathname();
  const [lastPath, setLastPath] = useState(pathName);

  useEffect(() => {
    if (pathName !== lastPath) {
      setLastPath(pathName);
      sendPageViewEvent({ gaId: gaMeasurementId, path: pathName });
    }
  }, [pathName, gaMeasurementId, lastPath]);

  return <></>;
}
