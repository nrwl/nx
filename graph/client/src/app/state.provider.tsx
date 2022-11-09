import { createContext } from 'react';
import { InterpreterFrom } from 'xstate';
import { projectGraphMachine } from './machines/project-graph.machine';
import { getProjectGraphService } from './machines/get-services';

export const GlobalStateContext = createContext<
  InterpreterFrom<typeof projectGraphMachine>
>({} as InterpreterFrom<typeof projectGraphMachine>);

export const GlobalStateProvider = (props) => {
  const depGraphService = getProjectGraphService();

  return (
    <GlobalStateContext.Provider value={depGraphService as any}>
      {props.children}
    </GlobalStateContext.Provider>
  );
};
