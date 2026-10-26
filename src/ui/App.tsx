// ============================================================================
// Main Application Component
// Sets up Three.js Canvas and mounts React Horror UI
// ============================================================================

import React, { useEffect, useRef } from 'react';
import { game } from '../engine/game';
import { useGameStore } from '../state/store';
import { HUD } from './HUD';
import { NoteModal } from './NoteModal';
import { MenuModal } from './MenuModal';
import { TitleScreen, GameOverScreen, VictoryScreen } from './Screens';

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { status } = useGameStore();

  useEffect(() => {
    if (canvasRef.current) {
      game.init(canvasRef.current);
    }
    return () => {
      game.destroy();
    };
  }, []);

  return (
    <div className="app-root">
      {/* Three.js 3D Viewport */}
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Diegetic In-Game HUD */}
      {status === 'playing' && <HUD />}

      {/* Reading Lore Document Popup */}
      <NoteModal />

      {/* Pause Menu & Settings */}
      <MenuModal />

      {/* Screen States */}
      <TitleScreen />
      <GameOverScreen />
      <VictoryScreen />
    </div>
  );
};
