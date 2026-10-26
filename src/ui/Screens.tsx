// ============================================================================
// Title Screen, Game Over Screen, and Victory Screen Components
// ============================================================================

import React from 'react';
import { useGameStore } from '../state/store';
import { input } from '../engine/input';
import { soundEngine } from '../audio/audioEngine';

export const TitleScreen: React.FC = () => {
  const status = useGameStore((s) => s.status);
  const setStatus = useGameStore((s) => s.setStatus);
  if (status !== 'title') return null;

  const handleStart = () => {
    soundEngine.init();
    soundEngine.resume();
    setStatus('playing');
    input.requestPointerLock();
  };

  return (
    <div className="title-screen-backdrop">
      <div className="title-card">
        <div className="title-tag">SECTOR B-09 // SURVIVAL HORROR</div>
        <h1 className="title-main">ARGON: HOLLOW</h1>
        <p className="title-lore">
          October 1994. The logging valley of Argon Hollow has been quarantined after an anomaly at research sector B-09.
          You are trapped in the mist. The entities in the fog freeze when observed, but hunt by the sound of your breath.
        </p>

        <div className="title-instructions">
          <div>• <strong>Look at the Pale Bride</strong> with your flashlight to freeze her in place.</div>
          <div>• <strong>Crouch and stay quiet</strong> near the blind Hollowed shamblers.</div>
          <div>• <strong>Do not stare</strong> into the eyes of the Watcher in the fog.</div>
          <div>• Find <strong>3 high-voltage fuses</strong> to restore the hilltop radio tower and unlock the blast gate.</div>
        </div>

        <button className="start-btn" onClick={handleStart}>
          ENTER THE HOLLOW [CLICK TO PLAY]
        </button>
        <div className="title-subnote">Headphones recommended. Use mouse to look, WASD to move.</div>
      </div>
    </div>
  );
};

export const GameOverScreen: React.FC = () => {
  const status = useGameStore((s) => s.status);
  const deathMessage = useGameStore((s) => s.deathMessage);
  const kills = useGameStore((s) => s.kills);
  const survivalTime = useGameStore((s) => s.survivalTime);
  const resetGame = useGameStore((s) => s.resetGame);

  if (status !== 'gameover') return null;

  const handleRetry = () => {
    resetGame();
    input.requestPointerLock();
  };

  const m = Math.floor(survivalTime / 60);
  const s = Math.floor(survivalTime % 60);
  const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  return (
    <div className="gameover-backdrop">
      <div className="gameover-card">
        <h1 className="gameover-title">YOU DIED</h1>
        <p className="gameover-reason">{deathMessage}</p>
        <div className="endgame-stats">
          KILLS: <strong>{kills}</strong> &nbsp;|&nbsp; TIME SURVIVED: <strong>{timeStr}</strong>
        </div>
        <p className="gameover-sub">Argon Hollow claimed another victim in the dark.</p>
        <button className="retry-btn" onClick={handleRetry}>
          TRY AGAIN
        </button>
      </div>
    </div>
  );
};

export const VictoryScreen: React.FC = () => {
  const status = useGameStore((s) => s.status);
  const kills = useGameStore((s) => s.kills);
  const survivalTime = useGameStore((s) => s.survivalTime);
  const resetGame = useGameStore((s) => s.resetGame);

  if (status !== 'victory') return null;

  const m = Math.floor(survivalTime / 60);
  const s = Math.floor(survivalTime % 60);
  const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  return (
    <div className="victory-backdrop">
      <div className="victory-card">
        <h1 className="victory-title">YOU ESCAPED</h1>
        <p className="victory-text">
          The emergency radio broadcast overrode the quarantine lock. The heavy steel blast gates groaned open just long
          enough for you to stumble through into the morning light.
        </p>
        <div className="endgame-stats">
          KILLS: <strong>{kills}</strong> &nbsp;|&nbsp; ESCAPE TIME: <strong>{timeStr}</strong>
        </div>
        <p className="victory-sub">The valley behind you lies silent again... waiting for the next trespasser.</p>
        <button className="primary-btn" onClick={resetGame}>
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
};
