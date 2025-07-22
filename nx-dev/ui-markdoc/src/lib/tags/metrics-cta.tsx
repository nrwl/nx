'use client';

/* this is a separate component s.t. it can be client-side only to avoid hydration errors*/

import { ButtonLink } from '@nx/nx-dev-ui-common';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';

export function MetricsCTA() {
  return (
    <div className="not-prose flex flex-col space-y-3">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        Ready to get started?
      </h3>
      <ButtonLink
        href="/contact/sales"
        title="Reach out"
        variant="primary"
        size="default"
        onClick={() =>
          sendCustomEvent('request-trial-click', 'metrics-cta', 'blog')
        }
      >
        Reach out
      </ButtonLink>
    </div>
  );
}
