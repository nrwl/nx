import { createContext } from 'react';
import { InterpreterFrom } from 'xstate';
import { depGraphMachine } from './machines/dep-graph.machine';
import { getDepGraphService } from './machines/dep-graph.service';

export const GlobalStateContext = createContext<
  InterpreterFrom<typeof depGraphMachine>
>({} as InterpreterFrom<typeof depGraphMachine>);

export const GlobalStateProvider = (props) => {
  const depGraphService = getDepGraphService();

  return (
    <GlobalStateContext.Provider value={depGraphService}>
      {props.children}
    </GlobalStateContext.Provider>
  );
};
