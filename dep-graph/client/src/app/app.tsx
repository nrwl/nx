import { Shell } from './shell';
import { GlobalStateProvider } from './state.provider';

export function App() {
  return (
    <GlobalStateProvider>
      <Shell></Shell>
    </GlobalStateProvider>
  );
}

export default App;
