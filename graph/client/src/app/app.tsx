import { Shell } from './shell';
import { GlobalStateProvider } from './state.provider';
import { themeInit } from './theme-resolver';

themeInit();

export function App() {
  return (
    <GlobalStateProvider>
      <Shell />
    </GlobalStateProvider>
  );
}

export default App;
