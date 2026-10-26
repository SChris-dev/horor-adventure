// ============================================================================
// Diegetic Survival Horror HUD: Health/EKG, Stamina, Sanity, Ammo & Objectives
// Optimized with granular Zustand selectors to eliminate React VDOM GC freezes.
// Features: Kills & Time Tracker, Tactical Crosshair, Dynamic Pickup Banners.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useGameStore } from '../state/store';
import { game } from '../engine/game';
import { InteractableItem } from '../world/landmarks';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const HUD: React.FC = () => {
  // Granular selectors: re-renders occur ONLY when specific primitive values change
  const hp = useGameStore((s) => s.hp);
  const maxHp = useGameStore((s) => s.maxHp);
  const stamina = useGameStore((s) => s.stamina);
  const staminaMax = useGameStore((s) => s.staminaMax);
  const sanity = useGameStore((s) => s.sanity);
  const flashlightOn = useGameStore((s) => s.flashlightOn);
  const battery = useGameStore((s) => s.battery);

  const currentWeapon = useGameStore((s) => s.currentWeapon);
  const pistolMag = useGameStore((s) => s.pistolMag);
  const pistolReserve = useGameStore((s) => s.pistolReserve);
  const shotgunMag = useGameStore((s) => s.shotgunMag);
  const shotgunReserve = useGameStore((s) => s.shotgunReserve);
  const isReloading = useGameStore((s) => s.isReloading);

  const currentObjective = useGameStore((s) => s.currentObjective);
  const objectiveHint = useGameStore((s) => s.objectiveHint);
  const fusesCollected = useGameStore((s) => s.fusesCollected);
  const medkits = useGameStore((s) => s.medkits);
  const batteries = useGameStore((s) => s.batteries);

  const kills = useGameStore((s) => s.kills);
  const survivalTime = useGameStore((s) => s.survivalTime);
  const hudBanner = useGameStore((s) => s.hudBanner);
  const hitMarkerTimer = useGameStore((s) => s.hitMarkerTimer);

  // Throttled interactable query (10Hz) to prevent render thrashing
  const [nearbyItem, setNearbyItem] = useState<InteractableItem | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const item = game.getNearbyInteractable();
      setNearbyItem(item);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const isPistol = currentWeapon === 'pistol';
  const mag = isPistol ? pistolMag : shotgunMag;
  const reserve = isPistol ? pistolReserve : shotgunReserve;
  const weaponName = isPistol ? 'M1911 Service Pistol' : 'Double-Barrel Shotgun';

  return (
    <div className="hud-container">
      {/* Top Left: Active Objectives */}
      <div className="objective-panel">
        <div className="objective-badge">BIOWEAPON CONTAINMENT // B-09</div>
        <div className="objective-title">{currentObjective}</div>
        {objectiveHint && <div className="objective-hint">{objectiveHint}</div>}
        <div className="fuses-tracker">
          Fuses: <span className={fusesCollected >= 3 ? 'text-green' : 'text-amber'}>{fusesCollected}/3</span>
        </div>
      </div>

      {/* Top Right: Kills & Survival Time from legacy/index.html */}
      <div className="stats-panel">
        KILLS: <span className="stats-val">{kills}</span> &nbsp;|&nbsp; TIME: <span className="stats-val">{formatTime(survivalTime)}</span>
      </div>

      {/* Screen Center: Tactical Crosshair & Interaction Prompt */}
      <div className="crosshair-wrapper">
        <div className="crosshair-dot" />
        <div className="crosshair-ticks">
          <div className="ch-tick ch-top" />
          <div className="ch-tick ch-bottom" />
          <div className="ch-tick ch-left" />
          <div className="ch-tick ch-right" />
        </div>

        {hitMarkerTimer > 0 && <div className="hitmarker" />}

        {nearbyItem && (
          <div className="interaction-prompt">
            <span className="key-badge">E</span>
            <span>{nearbyItem.prompt.replace('Press [E] to ', '')}</span>
          </div>
        )}
      </div>

      {/* Floating HUD Notification Banner (Pickups, Ammo, Reload) */}
      {hudBanner && <div className="hud-banner">{hudBanner}</div>}

      {/* Bottom Left: Health EKG, Stamina, Sanity */}
      <div className="vitals-panel">
        {/* EKG Heartbeat & Health Bar */}
        <div className="vital-row">
          <div className="vital-label">HEALTH</div>
          <div className="bar-track">
            <div
              className={`bar-fill ${hp < 30 ? 'critical-pulse' : ''}`}
              style={{
                width: `${(hp / maxHp) * 100}%`,
                backgroundColor: hp > 50 ? '#2ecc71' : hp > 25 ? '#f39c12' : '#e74c3c'
              }}
            />
          </div>
          <div className="vital-val">{Math.round(hp)}</div>
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

