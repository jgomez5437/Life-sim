import { GameCanvas } from './scene/GameCanvas';
import { HUD } from './ui/HUD';

export function App() {
  return (
    <main className="app-shell">
      <GameCanvas />
      <HUD />
    </main>
  );
}

export default App;
