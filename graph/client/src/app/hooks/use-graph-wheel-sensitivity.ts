import { useRendererEvents } from '@nx/graph';
import type { RendererConfig, RendererEventBus } from '@nx/graph';

import { applyGraphWheelSensitivity } from '../util/graph-wheel-sensitivity';

export function useGraphWheelSensitivity(
  orchestrator: RendererEventBus<RendererConfig> | null
) {
  useRendererEvents(orchestrator, {
    postRender: ({ cy }) => {
      applyGraphWheelSensitivity(cy);
    },
  });
}
