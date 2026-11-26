import { ErrorBoundary } from './components/ErrorBoundary';
import { CityViewport } from './engine/CityViewport';
import { TopBar } from './components/TopBar';
import { LeftDock } from './components/LeftDock';
import { RightInspector } from './components/RightInspector';
import { BottomBuildDock } from './components/BottomBuildDock';
import { BottomTicker } from './components/BottomTicker';
import { GameModals } from './components/Modals';

export default function App() {
  return (
    <ErrorBoundary>
      <main className="relative w-screen h-screen overflow-hidden bg-slate-950">
        {/* Dedicated Three.js 3D WebGL Canvas Mount */}
        <div className="absolute inset-0 z-0">
          <CityViewport />
        </div>

        {/* Strategy HUD Layers */}
        <TopBar />
        <LeftDock />
        <RightInspector />
        <BottomBuildDock />
        <BottomTicker />
        <GameModals />
      </main>
    </ErrorBoundary>
  );
}
