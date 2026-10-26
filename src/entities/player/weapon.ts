// ============================================================================
// First-Person Weapon System: M1911 Pistol & Double-Barrel Shotgun
// Features: Tritium Green Sights, Muzzle Flash, Raycast Enemy Combat, Hit FX, Realistic Reload
// ============================================================================

import * as THREE from 'three';
import { WEAPONS, WeaponDef } from '../../core/config';
import { useGameStore } from '../../state/store';
import { soundEngine } from '../../audio/audioEngine';
import { physics } from '../../engine/physics';
import { getTextureAtlas } from '../../engine/textures';

export type EnemyRayTester = (
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  range: number,
  damage: number
) => { hit: boolean; point: THREE.Vector3 } | null;

export class WeaponSystem {
  public group = new THREE.Group();
  private pistolMesh!: THREE.Group;
  private shotgunMesh!: THREE.Group;
  private muzzleFlashLight!: THREE.PointLight;

  private currentDef: WeaponDef = WEAPONS.pistol;
  private cooldownTimer = 0;
  private reloadTimer = 0;
  private isReloadingLocal = false;

  private recoilOffset = new THREE.Vector3();
  private recoilRot = new THREE.Euler();

  // Particle hit sparks & blood
  private sparkPoints!: THREE.Points;
  private sparkVelocities: THREE.Vector3[] = [];
  private sparkLives: number[] = [];
  private sparkCount = 80;

  public init(camera: THREE.Camera): void {
    const textures = getTextureAtlas();

    // 1. Build M1911 Pistol Viewmodel (with Tritium front sight)
    this.pistolMesh = this.buildPistolModel();
    this.group.add(this.pistolMesh);

    // 2. Build Shotgun Viewmodel
    this.shotgunMesh = this.buildShotgunModel(textures);
    this.group.add(this.shotgunMesh);
    this.shotgunMesh.visible = false;

    // 3. Dynamic Muzzle Flash Light
    this.muzzleFlashLight = new THREE.PointLight(0xffaa44, 0, 12, 2);
    this.muzzleFlashLight.position.set(0.24, -0.16, -0.65);
    this.group.add(this.muzzleFlashLight);

    camera.add(this.group);

    // 4. Spark & Blood hit particles
    this.initHitParticles();
  }

  private initHitParticles(): void {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(this.sparkCount * 3);
    const cols = new Float32Array(this.sparkCount * 3);

    for (let i = 0; i < this.sparkCount; i++) {
      this.sparkVelocities.push(new THREE.Vector3());
      this.sparkLives.push(0);
      pos[i * 3] = 0;
      pos[i * 3 + 1] = -999;
      pos[i * 3 + 2] = 0;
      cols[i * 3] = 1;
      cols[i * 3 + 1] = 0.8;
      cols[i * 3 + 2] = 0.3;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.95
    });

    this.sparkPoints = new THREE.Points(geo, mat);
    this.group.parent?.parent?.add(this.sparkPoints); // add to scene if possible
  }

  public spawnSparks(hitPoint: THREE.Vector3, isBlood: boolean): void {
    const posAttr = this.sparkPoints?.geometry.attributes.position;
    const colAttr = this.sparkPoints?.geometry.attributes.color;
    if (!posAttr || !colAttr) return;

    let spawned = 0;
    const count = isBlood ? 16 : 10;

    for (let i = 0; i < this.sparkCount && spawned < count; i++) {
      if (this.sparkLives[i] <= 0) {
        this.sparkLives[i] = 0.25 + Math.random() * 0.2;
        posAttr.setXYZ(i, hitPoint.x, hitPoint.y, hitPoint.z);

        const speed = isBlood ? 2.5 + Math.random() * 3.5 : 4.0 + Math.random() * 5.0;
        this.sparkVelocities[i].set(
          (Math.random() - 0.5) * speed,
          Math.random() * speed * 0.8 + 1.0,
          (Math.random() - 0.5) * speed
        );

        if (isBlood) {
          colAttr.setXYZ(i, 0.85, 0.05, 0.05);
        } else {
          colAttr.setXYZ(i, 1.0, 0.75, 0.2);
        }
        spawned++;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  private buildPistolModel(): THREE.Group {
    const grp = new THREE.Group();
    grp.position.set(0.24, -0.24, -0.42);

    const darkSteel = new THREE.MeshStandardMaterial({
      color: 0x282c32,
      roughness: 0.35,
      metalness: 0.85
    });
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.85,
      metalness: 0.1
    });

    // Glowing Tritium Green Sight Material
    const sightMat = new THREE.MeshStandardMaterial({
      color: 0x44ff66,
      emissive: 0x22cc44,
      emissiveIntensity: 1.8
    });

    // Slide
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.062, 0.26), darkSteel);
    slide.position.set(0, 0.035, -0.04);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.29), darkSteel);
    barrel.position.set(0, 0.035, -0.06);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.13, 0.075), gripMat);
    grip.position.set(0, -0.045, 0.045);
    grip.rotation.x = -0.22;

    // Glowing Tritium Front Sight Notch (Iconic from legacy/index.html)
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.014, 0.014), sightMat);
    frontSight.position.set(0, 0.072, -0.16);

    // Rear notch sights
    const rearSightL = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.01), darkSteel);
    rearSightL.position.set(-0.018, 0.07, 0.07);
    const rearSightR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.01), darkSteel);
    rearSightR.position.set(0.018, 0.07, 0.07);

    grp.add(slide, barrel, grip, frontSight, rearSightL, rearSightR);
    return grp;
  }

  private buildShotgunModel(textures: ReturnType<typeof getTextureAtlas>): THREE.Group {
    const grp = new THREE.Group();
    grp.position.set(0.22, -0.28, -0.48);

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x3e444c,
      metalness: 0.85,
      roughness: 0.35
    });
    const woodMat = new THREE.MeshStandardMaterial({
      map: textures.woodPlanks,
      roughness: 0.8
    });

    // Twin barrels
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.46, 8), metalMat);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.022, 0.03, -0.19);

    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.46, 8), metalMat);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.022, 0.03, -0.19);

    // Wooden Stock & Fore-end
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.28), woodMat);
    stock.position.set(0, -0.06, 0.12);
    stock.rotation.x = 0.18;

    grp.add(barrelL, barrelR, stock);
    return grp;
  }

  public shoot(camera: THREE.Camera, enemyTester?: EnemyRayTester): boolean {
    const state = useGameStore.getState();
    if (this.isReloadingLocal || this.cooldownTimer > 0) return false;

    const isPistol = state.currentWeapon === 'pistol';
    const currentMag = isPistol ? state.pistolMag : state.shotgunMag;

    if (currentMag <= 0) {
      soundEngine.playDryFire();
      this.cooldownTimer = 0.22;
      return false;
    }

    // Deduct ammo
    if (isPistol) {
      useGameStore.setState({ pistolMag: currentMag - 1 });
      soundEngine.playPistolShot();
    } else {
      useGameStore.setState({ shotgunMag: currentMag - 1 });
      soundEngine.playShotgunShot();
    }

    // Recoil kick & cooldown
    this.cooldownTimer = this.currentDef.cooldown;
    this.recoilOffset.set(0, 0.035, 0.09);
    this.recoilRot.x = this.currentDef.recoil;

    // Flash light
    this.muzzleFlashLight.intensity = 22;
    setTimeout(() => {
      this.muzzleFlashLight.intensity = 0;
    }, 45);

    // Raycast shooting
    const pellets = this.currentDef.pellets;
    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir);

    for (let p = 0; p < pellets; p++) {
      const dir = camDir.clone();
      if (pellets > 1) {
        dir.x += (Math.random() - 0.5) * this.currentDef.spread;
        dir.y += (Math.random() - 0.5) * this.currentDef.spread;
        dir.normalize();
      }

      // 1. Direct Enemy Ray Test
      let hitEnemy = false;
      if (enemyTester) {
        const result = enemyTester(camPos, dir, this.currentDef.range, this.currentDef.damage);
        if (result && result.hit) {
          hitEnemy = true;
          this.spawnSparks(result.point, true);
          soundEngine.playEnemyHit();
          useGameStore.getState().triggerHitMarker();
        }
      }

      // 2. Static Obstacle Hit (if missed enemy)
      if (!hitEnemy) {
        const obstacleHit = physics.raycast(camPos, dir, this.currentDef.range);
        if (obstacleHit) {
          this.spawnSparks(obstacleHit.point, false);
        }
      }
    }

    return true;
  }

  public reload(): void {
    const state = useGameStore.getState();
    if (this.isReloadingLocal) return;

    const isPistol = state.currentWeapon === 'pistol';
    const mag = isPistol ? state.pistolMag : state.shotgunMag;
    const reserve = isPistol ? state.pistolReserve : state.shotgunReserve;
    const magSize = this.currentDef.magSize;

    if (mag >= magSize || reserve <= 0) return;

    this.isReloadingLocal = true;
    this.reloadTimer = this.currentDef.reloadTime;
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
      this.isReloadingLocal = false;
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

    if (this.isReloadingLocal && this.reloadTimer > 0) {
      this.reloadTimer -= dt;
    }

    // Smooth recoil recovery
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), dt * 16);
    this.recoilRot.x = THREE.MathUtils.lerp(this.recoilRot.x, 0, dt * 14);

    const activeMesh = isPistol ? this.pistolMesh : this.shotgunMesh;
    const basePos = isPistol ? new THREE.Vector3(0.24, -0.24, -0.42) : new THREE.Vector3(0.22, -0.28, -0.48);

    // Reload dipping & tilting animation
    let reloadDip = 0;
    let reloadTilt = 0;
    if (this.isReloadingLocal) {
      const progress = 1 - Math.max(0, this.reloadTimer / this.currentDef.reloadTime);
      reloadDip = Math.sin(progress * Math.PI) * 0.12;
      reloadTilt = -0.45;
    }

    activeMesh.position.set(
      basePos.x + this.recoilOffset.x,
      basePos.y - reloadDip + this.recoilOffset.y,
      basePos.z + this.recoilOffset.z
    );
    activeMesh.rotation.set(
      this.recoilRot.x + reloadTilt,
      0,
      reloadTilt * 0.4
    );

    // Update spark particles
    if (this.sparkPoints) {
      const posAttr = this.sparkPoints.geometry.attributes.position;
      let anyAlive = false;

      for (let i = 0; i < this.sparkCount; i++) {
        if (this.sparkLives[i] > 0) {
          anyAlive = true;
          this.sparkLives[i] -= dt;
          if (this.sparkLives[i] <= 0) {
            posAttr.setY(i, -999);
          } else {
            this.sparkVelocities[i].y -= 9.8 * dt;
            const px = posAttr.getX(i) + this.sparkVelocities[i].x * dt;
            const py = posAttr.getY(i) + this.sparkVelocities[i].y * dt;
            const pz = posAttr.getZ(i) + this.sparkVelocities[i].z * dt;
            posAttr.setXYZ(i, px, py, pz);
          }
        }
      }
      if (anyAlive) {
        posAttr.needsUpdate = true;
      }
    }
  }
}

