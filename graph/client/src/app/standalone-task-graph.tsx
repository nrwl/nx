import { useEffect, useRef } from 'react';
import { useTaskGraphClient } from '@nx/graph/tasks';

interface StandaloneTaskGraphProps {
  taskData: any;
  renderPlatform?: 'cytoscape' | 'd3';
  onGraphReady?: (graphClient: any) => void;
}

export function StandaloneTaskGraph({
  taskData,
  renderPlatform = 'cytoscape',
  onGraphReady,
}: StandaloneTaskGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphClient = useTaskGraphClient();

  useEffect(() => {
    if (graphClient && taskData && containerRef.current) {
      // Initialize graph with task data
      graphClient.init({
        container: containerRef.current,
        taskGraph: taskData,
        renderPlatform,
      });

      // Handle task-specific initialization events
      graphClient.on('task-selected', (taskId: string) => {
        console.log('Task selected:', taskId);
      });

      // Notify parent component that graph is ready
      if (onGraphReady) {
        onGraphReady(graphClient);
      }
    }
  }, [graphClient, taskData, renderPlatform, onGraphReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}
