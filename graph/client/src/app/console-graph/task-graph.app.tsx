// import { useEffect, useRef, useCallback } from 'react';
// import { useTaskGraphClient } from '@nx/graph/tasks';
// import { createMachine, interpret } from 'xstate';

// interface StandaloneTaskGraphProps {
//   taskData: any;
//   renderPlatform?: 'cytoscape' | 'd3';
//   onGraphReady?: (graphClient: any) => void;
// }

// export function StandaloneTaskGraph({
//   taskData,
//   renderPlatform = 'cytoscape',
//   onGraphReady,
// }: StandaloneTaskGraphProps) {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const graphClient = useTaskGraphClient();
//   const interpreterRef = useRef<any>(null);

//   // Create and start XState interpreter for task graph
//   useEffect(() => {
//     const machine = createMachine({
//       id: 'standaloneTaskGraph',
//       initial: 'initializing',
//       states: {
//         initializing: {
//           on: {
//             INITIALIZED: 'ready',
//           },
//         },
//         ready: {
//           on: {
//             UPDATE_TASKS: 'updating',
//             SELECT_TASK: 'selecting',
//             RUN_TASK: 'running',
//             RESET: 'ready',
//           },
//         },
//         updating: {
//           on: {
//             UPDATE_COMPLETE: 'ready',
//           },
//         },
//         selecting: {
//           on: {
//             SELECT_COMPLETE: 'ready',
//           },
//         },
//         running: {
//           on: {
//             RUN_COMPLETE: 'ready',
//             RUN_FAILED: 'ready',
//           },
//         },
//       },
//     });

//     interpreterRef.current = interpret(machine).start();

//     return () => {
//       interpreterRef.current?.stop();
//     };
//   }, []);

//   // Wire up event forwarding from graph client to state machine
//   const handleGraphEvent = useCallback((event: any) => {
//     if (interpreterRef.current) {
//       interpreterRef.current.send(event);
//     }
//   }, []);

//   useEffect(() => {
//     if (graphClient && taskData && containerRef.current) {
//       // Initialize graph with task data
//       graphClient.init({
//         container: containerRef.current,
//         taskGraph: taskData,
//         renderPlatform,
//       });

//       // Set up event listeners for task-specific events
//       graphClient.on('initialized', () => {
//         interpreterRef.current?.send('INITIALIZED');
//       });

//       graphClient.on('task-selected', (taskId: string) => {
//         interpreterRef.current?.send({ type: 'SELECT_TASK', taskId });
//       });

//       graphClient.on('task-run', (taskId: string) => {
//         interpreterRef.current?.send({ type: 'RUN_TASK', taskId });
//       });

//       // Expose service methods for external control
//       const enhancedClient = {
//         ...graphClient,
//         interpreter: interpreterRef.current,
//         send: (event: any) => {
//           handleGraphEvent(event);
//           return graphClient.send?.(event);
//         },
//       };

//       // Notify parent component that graph is ready
//       if (onGraphReady) {
//         onGraphReady(enhancedClient);
//       }
//     }
//   }, [graphClient, taskData, renderPlatform, onGraphReady, handleGraphEvent]);

//   return <div ref={containerRef} className="h-full w-full" />;
// }
