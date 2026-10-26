// ============================================================================
// First-Person Weapon System: M1911 Pistol & Double-Barrel Shotgun
// Features: 3D viewmodels, recoil animation, muzzle flash, raycast shooting & reloading
// ============================================================================

import * as THREE from 'three';
import { WEAPONS, WeaponDef } from '../../core/config';
import { useGameStore } from '../../state/store';
import { soundEngine } from '../../audio/audioEngine';
import { physics } from '../../engine/physics';
import { getTextureAtlas } from '../../engine/textures';

export interface ShotResult {
  hit: boolean;
  point?: THREE.Vector3;
  normal?: THREE.Vector3;
  target?: unknown;
}

export class WeaponSystem {
  public group = new THREE.Group();
  private pistolMesh!: THREE.Group;
  private shotgunMesh!: THREE.Group;
  private muzzleFlashLight!: THREE.PointLight;

  private currentDef: WeaponDef = WEAPONS.pistol;
  private cooldownTimer = 0;
  private recoilOffset = new THREE.Vector3();
  private recoilRot = new THREE.Euler();

  public init(camera: THREE.Camera): void {
    const textures = getTextureAtlas();

    // 1. Build M1911 Pistol Viewmodel
    this.pistolMesh = this.buildPistolModel();
    this.group.add(this.pistolMesh);

    // 2. Build Shotgun Viewmodel
    this.shotgunMesh = this.buildShotgunModel(textures);
    this.group.add(this.shotgunMesh);
    this.shotgunMesh.visible = false;

    // 3. Muzzle Flash dynamic light
    this.muzzleFlashLight = new THREE.PointLight(0xffaa33, 0, 10);
    this.muzzleFlashLight.position.set(0.2, -0.15, -0.65);
    this.group.add(this.muzzleFlashLight);

    camera.add(this.group);
  }

  private buildPistolModel(): THREE.Group {
    const grp = new THREE.Group();
    grp.position.set(0.24, -0.26, -0.48);

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x181818,
      metalness: 0.85,
      roughness: 0.3
    });
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x241712,
      roughness: 0.7
    });

    // Slide
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.052, 0.22), steelMat);
    slide.position.set(0, 0.04, -0.04);

    // Barrel opening
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 8), steelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, -0.15);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.07), gripMat);
    grip.position.set(0, -0.04, 0.03);
    grip.rotation.x = 0.22;

    grp.add(slide, barrel, grip);
    return grp;
  }

  private buildShotgunModel(textures: ReturnType<typeof getTextureAtlas>): THREE.Group {
    const grp = new THREE.Group();
    grp.position.set(0.22, -0.3, -0.52);

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x222224,
      metalness: 0.9,
      roughness: 0.25
    });
    const woodMat = new THREE.MeshStandardMaterial({
      map: textures.woodPlanks,
      roughness: 0.8
    });

    // Twin barrels
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 8), metalMat);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.022, 0.03, -0.18);

    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 8), metalMat);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.022, 0.03, -0.18);

    // Wooden Stock & Fore-end
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.26), woodMat);
    stock.position.set(0, -0.06, 0.12);
    stock.rotation.x = 0.18;

    grp.add(barrelL, barrelR, stock);
    return grp;
  }

  public shoot(camera: THREE.Camera, onEnemyHit?: (hitPoint: THREE.Vector3, damage: number) => void): boolean {
    const state = useGameStore.getState();
    if (state.isReloading || this.cooldownTimer > 0) return false;

    const isPistol = state.currentWeapon === 'pistol';
    const currentMag = isPistol ? state.pistolMag : state.shotgunMag;

    if (currentMag <= 0) {
      soundEngine.playDryFire();
      this.reload();
      return false;
    }

    // Deduct ammo
    if (isPistol) {
      useGameStore.setState({ pistolMag: currentMag - 1 });
      soundEngine.playPistolShot(camera.position);
    } else {
      useGameStore.setState({ shotgunMag: currentMag - 1 });
      soundEngine.playShotgunShot(camera.position);
    }

    // Recoil kick & cooldown
    this.cooldownTimer = this.currentDef.cooldown;
    this.recoilOffset.set(0, 0.04, 0.08);
    this.recoilRot.x = this.currentDef.recoil;

    // Flash light
    this.muzzleFlashLight.intensity = 4.5;
    setTimeout(() => {
      this.muzzleFlashLight.intensity = 0;
    }, 45);

    // Raycast shooting
    const pellets = this.currentDef.pellets;
    for (let p = 0; p < pellets; p++) {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      if (pellets > 1) {
        dir.x += (Math.random() - 0.5) * this.currentDef.spread;
        dir.y += (Math.random() - 0.5) * this.currentDef.spread;
        dir.normalize();
      }

      const hit = physics.raycast(camera.position, dir, this.currentDef.range);
      if (hit && onEnemyHit) {
        onEnemyHit(hit.point, this.currentDef.damage);
      }
    }

    return true;
  }

  public reload(): void {
    const state = useGameStore.getState();
    if (state.isReloading) return;

    const isPistol = state.currentWeapon === 'pistol';
    const mag = isPistol ? state.pistolMag : state.shotgunMag;
    const reserve = isPistol ? state.pistolReserve : state.shotgunReserve;
    const magSize = this.currentDef.magSize;

    if (mag >= magSize || reserve <= 0) return;

    state.setReloading(true);
    soundEngine.playReload();

    setTimeout(() => {
      const s = useGameStore.getState();
      const needed = magSize - (isPistol ? s.pistolMag : s.shotgunMag);
      const toLoad = Math.min(needed, isPistol ? s.pistolReserve : s.shotgunReserve);

      if (isPistol) {
        s.setAmmo({
          pistolMag: s.pistolMag + toLoad,
          pistolReserve: s.pistolReserve - toLoad
        });
      } else {
        s.setAmmo({
          shotgunMag: s.shotgunMag + toLoad,
          shotgunReserve: s.shotgunReserve - toLoad
        });
      }
      s.setReloading(false);
    }, this.currentDef.reloadTime * 1000);
  }

  public update(dt: number): void {
    const state = useGameStore.getState();
    const isPistol = state.currentWeapon === 'pistol';

    this.currentDef = isPistol ? WEAPONS.pistol : WEAPONS.shotgun;
    this.pistolMesh.visible = isPistol;
    this.shotgunMesh.visible = !isPistol;

    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
    }

    // Smooth recoil recovery
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), dt * 14);
    this.recoilRot.x = THREE.MathUtils.lerp(this.recoilRot.x, 0, dt * 14);

    const activeMesh = isPistol ? this.pistolMesh : this.shotgunMesh;
    const basePos = isPistol ? new THREE.Vector3(0.24, -0.26, -0.48) : new THREE.Vector3(0.22, -0.3, -0.52);

    activeMesh.position.copy(basePos).add(this.recoilOffset);
    activeMesh.rotation.x = this.recoilRot.x;
  }
}
