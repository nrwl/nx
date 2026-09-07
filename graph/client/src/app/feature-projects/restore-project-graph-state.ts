import { GraphStateSerializer } from '@nx/graph';
import type {
  SerializableProjectGraphState,
  useProjectGraphContext,
} from '@nx/graph/projects';

export function restoreProjectGraphState(
  serializedState: string,
  graph: Pick<
    ReturnType<typeof useProjectGraphContext>,
    'send' | 'restoreGraphState'
  >
) {
  const state =
    new GraphStateSerializer<SerializableProjectGraphState>().deserialize(
      serializedState
    );
  if (!state) return;

  if (!state.s || state.s.type === 'default') {
    // A URL snapshot restores visibility even when its config is unchanged.
    // showAll clears focus and hidden nodes without resetting renderer preferences.
    graph.send({ type: 'showAll' });
  }

  return graph.restoreGraphState(serializedState);
}
