import { useEffect, useRef } from 'react';
import { useProjectGraphClient } from '@nx/graph/projects';

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

  useEffect(() => {
    if (graphClient && projectData && containerRef.current) {
      // Initialize graph with project data
      graphClient.init({
        container: containerRef.current,
        projectGraph: projectData,
        renderPlatform,
      });

      // Notify parent component that graph is ready
      if (onGraphReady) {
        onGraphReady(graphClient);
      }
    }
  }, [graphClient, projectData, renderPlatform, onGraphReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}
