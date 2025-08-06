import { useEffect, useRef, useCallback } from 'react';
import { useProjectGraphClient } from '@nx/graph/projects';
import { createMachine, interpret } from 'xstate';

interface StandaloneProjectGraphProps {
  projectData: any;
  renderPlatform?: 'cytoscape' | 'd3';
  onGraphReady?: (graphClient: any) => void;
}

export function StandaloneProjectGraph({
  projectData,
  renderPlatform = 'cytoscape',
  onGraphReady,
}: StandaloneProjectGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphClient = useProjectGraphClient();
  const interpreterRef = useRef<any>(null);

  // Create and start XState interpreter
  useEffect(() => {
    const machine = createMachine({
      id: 'standaloneProjectGraph',
      initial: 'initializing',
      states: {
        initializing: {
          on: {
            INITIALIZED: 'ready',
          },
        },
        ready: {
          on: {
            UPDATE_DATA: 'updating',
            FOCUS_NODE: 'focusing',
            RESET: 'ready',
          },
        },
        updating: {
          on: {
            UPDATE_COMPLETE: 'ready',
          },
        },
        focusing: {
          on: {
            FOCUS_COMPLETE: 'ready',
          },
        },
      },
    });

    interpreterRef.current = interpret(machine).start();

    return () => {
      interpreterRef.current?.stop();
    };
  }, []);

  // Wire up event forwarding from graph client to state machine
  const handleGraphEvent = useCallback((event: any) => {
    if (interpreterRef.current) {
      interpreterRef.current.send(event);
    }
  }, []);

  useEffect(() => {
    if (graphClient && projectData && containerRef.current) {
      // Initialize graph with project data
      graphClient.init({
        container: containerRef.current,
        projectGraph: projectData,
        renderPlatform,
      });

      // Set up event listeners for graph state changes
      graphClient.on('initialized', () => {
        interpreterRef.current?.send('INITIALIZED');
      });

      graphClient.on('nodeClick', (nodeId: string) => {
        interpreterRef.current?.send({ type: 'FOCUS_NODE', nodeId });
      });

      // Expose service methods for external control
      const enhancedClient = {
        ...graphClient,
        interpreter: interpreterRef.current,
        send: (event: any) => {
          handleGraphEvent(event);
          return graphClient.send?.(event);
        },
      };

      // Notify parent component that graph is ready
      if (onGraphReady) {
        onGraphReady(enhancedClient);
      }
    }
  }, [
    graphClient,
    projectData,
    renderPlatform,
    onGraphReady,
    handleGraphEvent,
  ]);

  return <div ref={containerRef} className="h-full w-full" />;
}
