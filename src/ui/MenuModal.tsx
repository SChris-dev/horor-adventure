// ============================================================================
// Pause Menu & Settings Modal: Quality Presets, Audio, Sensitivity, Controls
// ============================================================================

import React from 'react';
import { useGameStore } from '../state/store';
import { QualityLevel, QUALITY } from '../core/config';
import { gameRenderer } from '../engine/renderer';
import { input } from '../engine/input';
import { soundEngine } from '../audio/audioEngine';

export const MenuModal: React.FC = () => {
  const {
    status,
    setStatus,
    quality,
    setQuality,
    mouseSensitivity,
    setSensitivity,
    masterVolume,
    setMasterVolume,
    resetGame
  } = useGameStore();

  if (status !== 'paused') return null;

  const handleResume = () => {
    setStatus('playing');
    input.requestPointerLock();
  };

  const handleQualityChange = (q: QualityLevel) => {
    setQuality(q);
    gameRenderer.setQuality(q);
  };

  const handleVolumeChange = (v: number) => {
    setMasterVolume(v);
    soundEngine.setMasterVolume(v);
  };

  return (
    <div className="menu-backdrop">
      <div className="menu-panel">
        <h1 className="menu-title">GAME PAUSED</h1>
        <div className="menu-subtitle">Sector B-09 // Argon Hollow</div>

        {/* Quality Presets */}
        <div className="settings-section">
          <label className="section-title">GRAPHICS QUALITY PRESET</label>
          <div className="preset-buttons">
            {(['low', 'medium', 'high', 'ultra'] as QualityLevel[]).map((q) => (
              <button
                key={q}
                className={`preset-btn ${quality === q ? 'active' : ''}`}
                onClick={() => handleQualityChange(q)}
              >
                {QUALITY[q].label}
              </button>
            ))}
          </div>
          <div className="preset-description">
            {quality === 'low' && 'Optimized for potato laptops: 0.75x resolution, simple shadows, high fps.'}
            {quality === 'medium' && 'Balanced: native resolution, dynamic flashlight shadow, dense fog.'}
            {quality === 'high' && 'Recommended: full resolution, high-res shadows, film grain, bloom.'}
            {quality === 'ultra' && 'Maximum fidelity: 2x supersampling, ultra shadow maps, all particles.'}
          </div>
        </div>

        {/* Sliders */}
        <div className="settings-section">
          <div className="slider-row">
            <span>MASTER VOLUME</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={masterVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            />
            <span>{Math.round(masterVolume * 100)}%</span>
          </div>

          <div className="slider-row">
            <span>MOUSE SENSITIVITY</span>
            <input
              type="range"
              min="0.001"
              max="0.005"
              step="0.0002"
              value={mouseSensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            />
            <span>{Math.round((mouseSensitivity / 0.0022) * 100)}%</span>
          </div>
        </div>

        {/* Controls Cheatsheet */}
        <div className="settings-section controls-grid">
          <div><span className="key-tag">WASD</span> Move</div>
          <div><span className="key-tag">SHIFT</span> Sprint</div>
          <div><span className="key-tag">C</span> Crouch</div>
          <div><span className="key-tag">F</span> Flashlight</div>
          <div><span className="key-tag">L-CLICK</span> Fire</div>
          <div><span className="key-tag">R</span> Reload</div>
          <div><span className="key-tag">1 / 2</span> Switch Gun</div>
          <div><span className="key-tag">E</span> Interact</div>
          <div><span className="key-tag">Q</span> Heal</div>
          <div><span className="key-tag">T</span> Battery</div>
        </div>

        {/* Buttons */}
        <div className="menu-actions">
          <button className="primary-btn" onClick={handleResume}>
            RESUME MISSION
          </button>
          <button className="secondary-btn" onClick={resetGame}>
            RESTART MISSION
          </button>
        </div>
      </div>
    </div>
  );
};
