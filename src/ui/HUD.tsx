// ============================================================================
// Diegetic Survival Horror HUD: Health/EKG, Stamina, Sanity, Ammo & Objectives
// ============================================================================

import React from 'react';
import { useGameStore } from '../state/store';
import { game } from '../engine/game';

export const HUD: React.FC = () => {
  const {
    hp,
    maxHp,
    stamina,
    staminaMax,
    sanity,
    flashlightOn,
    battery,
    currentWeapon,
    pistolMag,
    pistolReserve,
    shotgunMag,
    shotgunReserve,
    isReloading,
    currentObjective,
    objectiveHint,
    hitMarkerTimer,
    fusesCollected,
    medkits,
    batteries
  } = useGameStore();

  const nearbyItem = game.getNearbyInteractable();
  const isPistol = currentWeapon === 'pistol';
  const mag = isPistol ? pistolMag : shotgunMag;
  const reserve = isPistol ? pistolReserve : shotgunReserve;
  const weaponName = isPistol ? 'M1911 Pistol' : 'Double-Barrel Shotgun';

  return (
    <div className="hud-container">
      {/* Top Left: Active Objectives */}
      <div className="objective-panel">
        <div className="objective-badge">MISSION DIRECTIVE</div>
        <div className="objective-title">{currentObjective}</div>
        {objectiveHint && <div className="objective-hint">{objectiveHint}</div>}
        <div className="fuses-tracker">
          Fuses: <span className={fusesCollected >= 3 ? 'text-green' : 'text-amber'}>{fusesCollected}/3</span>
        </div>
      </div>

      {/* Screen Center: Interaction Prompt & Crosshair */}
      <div className="crosshair-wrapper">
        <div className="crosshair-dot" />
        {hitMarkerTimer > 0 && <div className="hitmarker" />}
        {nearbyItem && (
          <div className="interaction-prompt">
            <span className="key-badge">E</span>
            <span>{nearbyItem.prompt.replace('Press [E] to ', '')}</span>
          </div>
        )}
      </div>

      {/* Bottom Left: Health EKG, Stamina, Sanity */}
      <div className="vitals-panel">
        {/* EKG Heartbeat & Health Bar */}
        <div className="vital-row">
          <div className="vital-label">VITALS</div>
          <div className="bar-track">
            <div
              className={`bar-fill ${hp < 30 ? 'critical-pulse' : ''}`}
              style={{
                width: `${(hp / maxHp) * 100}%`,
                backgroundColor: hp > 50 ? '#2ecc71' : hp > 25 ? '#f39c12' : '#e74c3c'
              }}
            />
          </div>
          <div className="vital-val">{Math.round(hp)}%</div>
        </div>

        {/* Stamina Bar */}
        <div className="vital-row">
          <div className="vital-label">STAMINA</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${(stamina / staminaMax) * 100}%`,
                backgroundColor: '#3498db'
              }}
            />
          </div>
        </div>

        {/* Sanity Bar */}
        <div className="vital-row">
          <div className="vital-label">SANITY</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${sanity}%`,
                backgroundColor: sanity > 40 ? '#9b59b6' : '#e74c3c'
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Right: Ammo, Flashlight Battery, Quick Items */}
      <div className="ammo-panel">
        <div className="weapon-name">{weaponName}</div>
        <div className="ammo-count">
          <span className="ammo-mag">{mag}</span>
          <span className="ammo-divider">/</span>
          <span className="ammo-reserve">{reserve}</span>
        </div>
        {isReloading && <div className="reloading-text">RELOADING...</div>}

        {/* Flashlight Battery */}
        <div className="battery-row">
          <span className={`flashlight-icon ${flashlightOn ? 'on' : 'off'}`}>⚡ LIGHT</span>
          <div className="battery-track">
            <div
              className="battery-fill"
              style={{
                width: `${battery}%`,
                backgroundColor: battery > 20 ? '#f1c40f' : '#e74c3c'
              }}
            />
          </div>
          <span className="battery-pct">{Math.round(battery)}%</span>
        </div>

        {/* Quick Item inventory keys */}
        <div className="inventory-shortcuts">
          <div className="shortcut-item" title="Press Q to heal">
            <span className="key-hint">[Q]</span> Medkit: {medkits}
          </div>
          <div className="shortcut-item" title="Press T for battery">
            <span className="key-hint">[T]</span> Battery: {batteries}
          </div>
        </div>
      </div>
    </div>
  );
};
