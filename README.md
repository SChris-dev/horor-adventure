# horor-adventure

# ARGON: HOLLOW — 3D Open-World Survival Horror

> An open-world psychological survival horror game set in quarantined Argon Hollow. Uncanny entities, 3D spatial audio, scarce resources, and dynamic horror pacing.

---

## 🎮 Features

- **Open-World Valley**: 512m × 512m forested valley bounded by quarantine cliffs, with abandoned cabins, ruined chapel, cemetery, lake docks, and hilltop radio tower.
- **Physics**: Rapier 3D WASM (`@dimforge/rapier3d-compat`) with smooth character controller and full terrain collision.
- **Smart Monster AI**:
  - **The Pale Bride (Wraith)**: Weeping angel mechanic — freezes in uncanny stop-motion stance when stared at under the flashlight; sprints silently with radio static when unseen.
  - **The Hollowed (Shambler)**: Graphic mutilated blind infected that hunt purely by sound (sprinting, gunshots) and flashlight beam.
  - **The Watcher (Tall Stalker)**: Towering silhouette standing at the fog line — direct eye contact drains sanity, triggers chromatic aberration and infrasound bass hum.
- **3D Spatial Web Audio**: HRTF spatial audio, dynamic crickets silencing when monsters stalk near, procedural gunfire, reload sounds, and thumping heartbeat.
- **Survival Combat**: M1911 pistol, double-barrel shotgun, scarce ammunition, and flashlight battery management.
- **Atmospheric Post-Processing**: Custom GLSL shader with film grain, chromatic aberration, cold teal-green grade, vignette, and sanity distortion.
- **Performance Presets**: Low (0.75x scaling for potato laptops), Medium, High, and Ultra.

---

## 🕹️ Controls

| Key | Action |
|---|---|
| `W A S D` | Move |
| `Shift` | Sprint |
| `C` | Crouch (quieter footsteps) |
| `Space` | Jump |
| `F` | Toggle Flashlight |
| `Left Click` | Fire Weapon |
| `R` | Reload |
| `1` / `2` | Switch Weapon (Pistol / Shotgun) |
| `E` | Interact (Pick up fuses, weapons, ammo, read notes) |
| `Q` | Use First-Aid Kit |
| `T` | Replace Flashlight Battery |
| `Esc` / `P` | Pause Menu & Graphics Settings |

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build for production
npm run build
```
