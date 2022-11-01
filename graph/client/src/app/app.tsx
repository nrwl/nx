import { Shell } from './shell';
import { GlobalStateProvider } from './state.provider';
import { themeInit } from './theme-resolver';
import { rankDirInit } from './rankdir-resolver';

themeInit();
rankDirInit();

export function App() {
  return (
    <GlobalStateProvider>
      <Shell />
    </GlobalStateProvider>
  );
}

export default App;
