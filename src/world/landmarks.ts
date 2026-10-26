// ============================================================================
// Landmarks and Interactive Props for Argon Hollow
// Builds Cabin interior, Chapel & Altar, Quarantine Gate, Radio Tower, Docks,
// and handles interactive items (keys, weapons, fuses, ammo, lore notes).
// ============================================================================

import * as THREE from 'three';
import { LAYOUT } from '../core/config';
import { getTextureAtlas } from '../engine/textures';
import { getTerrainHeight } from './terrain';
import { physics } from '../engine/physics';
import { useGameStore, NoteItem } from '../state/store';
import { soundEngine } from '../audio/audioEngine';

export interface InteractableItem {
  id: string;
  type: 'fuse' | 'key' | 'weapon' | 'ammo' | 'medkit' | 'battery' | 'note' | 'radio_generator' | 'exit_gate';
  prompt: string;
  position: THREE.Vector3;
  radius: number;
  mesh?: THREE.Object3D;
  data?: unknown;
}

export interface FloatingPickup {
  id: string;
  type: 'ammo' | 'medkit' | 'battery';
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  phase: number;
  collected: boolean;
}

export class LandmarksSystem {
  public group = new THREE.Group();
  public interactables: InteractableItem[] = [];
  public pickups: FloatingPickup[] = [];

  public init(): void {
    const textures = getTextureAtlas();

    // 1. Abandoned Cabin
    this.buildCabin(textures);

    // 2. Ruined Chapel
    this.buildChapel(textures);

    // 3. Lake Docks
    this.buildDocks(textures);

    // 4. Radio Tower & Generator
    this.buildRadioTower(textures);

    // 5. Quarantine Gate Checkpoint
    this.buildQuarantineGate(textures);

    // 6. Police Cruiser Wreck
    this.buildPoliceWreck(textures);

    // 7. Rotating Floating Pickups (Ammo & Medkits from legacy/index.html)
    this.spawnFloatingPickups();
  }

  private buildCabin(textures: ReturnType<typeof getTextureAtlas>): void {
    const c = LAYOUT.cabins[0];
    const y = getTerrainHeight(c.x, c.z);
    const cabinGroup = new THREE.Group();
    cabinGroup.position.set(c.x, y, c.z);
    cabinGroup.rotation.y = c.rot;

    const woodMat = new THREE.MeshStandardMaterial({
      map: textures.woodPlanks,
      roughness: 0.88
    });

    // Floor (8m x 6m)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 6), woodMat);
    floor.position.set(0, 0.15, 0);
    cabinGroup.add(floor);

    // Walls
    const wallMat = woodMat.clone();
    // Back wall
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 0.25), wallMat);
    backWall.position.set(0, 1.75, -2.9);
    cabinGroup.add(backWall);

    // Left wall
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 6), wallMat);
    leftWall.position.set(-3.9, 1.75, 0);
    cabinGroup.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 6), wallMat);
    rightWall.position.set(3.9, 1.75, 0);
    cabinGroup.add(rightWall);

    // Front wall with doorway (width 2m opening)
    const frontL = new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, 0.25), wallMat);
    frontL.position.set(-2.5, 1.75, 2.9);
    const frontR = new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, 0.25), wallMat);
    frontR.position.set(2.5, 1.75, 2.9);
    cabinGroup.add(frontL, frontR);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.25, 6.6), woodMat);
    roof.position.set(0, 3.4, 0);
    cabinGroup.add(roof);

    // Wooden Table inside
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.9), woodMat);
    tableTop.position.set(0, 0.85, -1.2);
    cabinGroup.add(tableTop);

    // Flickering lantern on table
    const lanternMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0x443322, metalness: 0.8 })
    );
    lanternMesh.position.set(-0.4, 1.02, -1.2);
    cabinGroup.add(lanternMesh);

    const lanternLight = new THREE.PointLight(0xffa544, 1.4, 12);
    lanternLight.position.set(-0.4, 1.25, -1.2);
    cabinGroup.add(lanternLight);

    // Add physics colliders for cabin
    physics.addBoxCollider(new THREE.Vector3(c.x, y + 1.75, c.z - 2.9), new THREE.Vector3(4, 1.6, 0.2));
    physics.addBoxCollider(new THREE.Vector3(c.x - 3.9, y + 1.75, c.z), new THREE.Vector3(0.2, 1.6, 3));
    physics.addBoxCollider(new THREE.Vector3(c.x + 3.9, y + 1.75, c.z), new THREE.Vector3(0.2, 1.6, 3));

    this.group.add(cabinGroup);

    // Interactive Items in Cabin:
    // 1. Double-Barrel Shotgun on table
    const shotgunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.12, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7 })
    );
    shotgunMesh.position.set(c.x + 0.2, y + 0.95, c.z - 1.2);
    this.group.add(shotgunMesh);

    this.interactables.push({
      id: 'cabin_shotgun',
      type: 'weapon',
      prompt: 'Press [E] to Take Double-Barrel Shotgun',
      position: new THREE.Vector3(c.x + 0.2, y + 0.95, c.z - 1.2),
      radius: 2.2,
      mesh: shotgunMesh,
      data: { weapon: 'shotgun', ammo: 6 }
    });

    // 2. Fuse #1 on table
    const fuse1Mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0xdd9922, metalness: 0.9, roughness: 0.2 })
    );
    fuse1Mesh.position.set(c.x - 0.15, y + 0.95, c.z - 1.1);
    this.group.add(fuse1Mesh);

    this.interactables.push({
      id: 'cabin_fuse',
      type: 'fuse',
      prompt: 'Press [E] to Take High-Voltage Fuse (1/3)',
      position: new THREE.Vector3(c.x - 0.15, y + 0.95, c.z - 1.1),
      radius: 2.0,
      mesh: fuse1Mesh
    });

    // 3. Bloody Journal on the table
    const noteMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.02, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xccbbaa, roughness: 0.9 })
    );
    noteMesh.position.set(c.x + 0.5, y + 0.92, c.z - 1.2);
    this.group.add(noteMesh);

    const cabinNote: NoteItem = {
      id: 'note_cabin',
      title: 'Torn Cabin Journal — Day 4',
      author: 'E. Vance (Logging Foreman)',
      date: 'October 1994',
      body: `The road has been barricaded by military trucks. Sector B-09 had a containment rupture two nights ago.
Whatever came out of the facility isn't human. It wears a tattered wedding veil and stalks only when you look away. Every time my lantern flickers or I blink, it moves closer.

I took one of the backup fuses from the radio generator to keep anyone from transmitting. The other two fuses are at the old chapel altar and the lake boat dock. If you are reading this, do NOT make noise. The blind shamblers hear every gunshot.`
    };

    this.interactables.push({
      id: 'cabin_note',
      type: 'note',
      prompt: 'Press [E] to Read Journal',
      position: new THREE.Vector3(c.x + 0.5, y + 0.92, c.z - 1.2),
      radius: 2.0,
      mesh: noteMesh,
      data: cabinNote
    });

    // 4. Medkit & Battery in corner
    this.interactables.push({
      id: 'cabin_medkit',
      type: 'medkit',
      prompt: 'Press [E] to Take First-Aid Kit',
      position: new THREE.Vector3(c.x + 2.5, y + 0.3, c.z + 1.8),
      radius: 2.0
    });
  }

  private buildChapel(textures: ReturnType<typeof getTextureAtlas>): void {
    const ch = LAYOUT.chapel;
    const y = getTerrainHeight(ch.x, ch.z);
    const chapelGroup = new THREE.Group();
    chapelGroup.position.set(ch.x, y, ch.z);

    const stoneMat = new THREE.MeshStandardMaterial({
      map: textures.stone,
      roughness: 0.92
    });

    // Nave walls (14m x 8m)
    // Left stone wall with arched window cuts
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.5, 14), stoneMat);
    leftWall.position.set(-4, 2.75, 0);
    chapelGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.5, 14), stoneMat);
    rightWall.position.set(4, 2.75, 0);
    chapelGroup.add(rightWall);

    // Altar apse
    const apseWall = new THREE.Mesh(new THREE.BoxGeometry(8, 5.5, 0.6), stoneMat);
    apseWall.position.set(0, 2.75, -7);
    chapelGroup.add(apseWall);

    // Front portal
    const frontL = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.5, 0.6), stoneMat);
    frontL.position.set(-2.6, 2.75, 7);
    const frontR = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.5, 0.6), stoneMat);
    frontR.position.set(2.6, 2.75, 7);
    chapelGroup.add(frontL, frontR);

    // Bell Tower on top
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.5, 9, 3.5), stoneMat);
    tower.position.set(0, 8, 5.5);
    chapelGroup.add(tower);

    // Stone Altar table
    const altar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.0), stoneMat);
    altar.position.set(0, 0.55, -5.2);
    chapelGroup.add(altar);

    // Altar dim flickering candle
    const candleLight = new THREE.PointLight(0xff7722, 1.2, 10);
    candleLight.position.set(0, 1.4, -5.2);
    chapelGroup.add(candleLight);

    // Rapier physics colliders
    physics.addBoxCollider(new THREE.Vector3(ch.x - 4, y + 2.75, ch.z), new THREE.Vector3(0.4, 2.75, 7));
    physics.addBoxCollider(new THREE.Vector3(ch.x + 4, y + 2.75, ch.z), new THREE.Vector3(0.4, 2.75, 7));
    physics.addBoxCollider(new THREE.Vector3(ch.x, y + 2.75, ch.z - 7), new THREE.Vector3(4, 2.75, 0.4));

    this.group.add(chapelGroup);

    // Interactive Fuse #2 on Chapel Altar
    const fuse2Mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0xdd9922, metalness: 0.9 })
    );
    fuse2Mesh.position.set(ch.x, y + 1.18, ch.z - 5.2);
    this.group.add(fuse2Mesh);

    this.interactables.push({
      id: 'chapel_fuse',
      type: 'fuse',
      prompt: 'Press [E] to Take High-Voltage Fuse (2/3)',
      position: new THREE.Vector3(ch.x, y + 1.18, ch.z - 5.2),
      radius: 2.2,
      mesh: fuse2Mesh
    });

    // Chapel Note
    const chapelNote: NoteItem = {
      id: 'note_chapel',
      title: "Father Thomas's Final Sermon",
      author: 'Father Thomas',
      body: `I saw the Tall One standing at the wood line during the lightning storm. It does not move like beasts do; it watches through the hollow mist. Looking into its white face burns away the mind and drives men mad.

The Gate to the north is locked under sector quarantine. Only the emergency broadcast from the hilltop radio tower can override the automated locks. Restore the three fuses to the generator!`
    };

    this.interactables.push({
      id: 'chapel_note',
      type: 'note',
      prompt: 'Press [E] to Read Altar Bible Note',
      position: new THREE.Vector3(ch.x + 0.6, y + 1.15, ch.z - 5.2),
      radius: 2.2,
      data: chapelNote
    });
  }

  private buildDocks(textures: ReturnType<typeof getTextureAtlas>): void {
    const lX = LAYOUT.lake.x;
    const lZ = LAYOUT.lake.z;
    const y = -3.0; // Water level is -3.2

    const pierGroup = new THREE.Group();
    pierGroup.position.set(lX - 35, y, lZ);

    const woodMat = new THREE.MeshStandardMaterial({
      map: textures.woodPlanks,
      roughness: 0.95
    });

    // Pier deck (24m long extending into lake)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(24, 0.25, 2.4), woodMat);
    deck.position.set(12, 0.12, 0);
    pierGroup.add(deck);

    this.group.add(pierGroup);
    physics.addBoxCollider(new THREE.Vector3(lX - 35 + 12, y + 0.12, lZ), new THREE.Vector3(12, 0.2, 1.2));

    // Fuse #3 at the tip of the pier
    const fuse3Pos = new THREE.Vector3(lX - 35 + 23, y + 0.4, lZ);
    const fuse3Mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0xdd9922, metalness: 0.9 })
    );
    fuse3Mesh.position.copy(fuse3Pos);
    this.group.add(fuse3Mesh);

    this.interactables.push({
      id: 'dock_fuse',
      type: 'fuse',
      prompt: 'Press [E] to Take High-Voltage Fuse (3/3)',
      position: fuse3Pos,
      radius: 2.4,
      mesh: fuse3Mesh
    });
  }

  private buildRadioTower(textures: ReturnType<typeof getTextureAtlas>): void {
    const rt = LAYOUT.radioTower;
    const y = getTerrainHeight(rt.x, rt.z);
    const towerGroup = new THREE.Group();
    towerGroup.position.set(rt.x, y, rt.z);

    const rustMat = new THREE.MeshStandardMaterial({
      map: textures.rustyMetal,
      roughness: 0.7,
      metalness: 0.6
    });

    // 4 Corner Lattice Legs (38m high)
    const legGeo = new THREE.CylinderGeometry(0.12, 0.18, 38, 6);
    legGeo.translate(0, 19, 0);

    const leg1 = new THREE.Mesh(legGeo, rustMat);
    leg1.position.set(-2, 0, -2);
    const leg2 = new THREE.Mesh(legGeo, rustMat);
    leg2.position.set(2, 0, -2);
    const leg3 = new THREE.Mesh(legGeo, rustMat);
    leg3.position.set(-2, 0, 2);
    const leg4 = new THREE.Mesh(legGeo, rustMat);
    leg4.position.set(2, 0, 2);
    towerGroup.add(leg1, leg2, leg3, leg4);

    // Blinking red aviation warning beacon at top
    const beaconLight = new THREE.PointLight(0xff1111, 2.5, 45);
    beaconLight.position.set(0, 39, 0);
    towerGroup.add(beaconLight);

    // Generator Shed at base
    const shed = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.5), rustMat);
    shed.position.set(0, 1.2, 0);
    towerGroup.add(shed);

    this.group.add(towerGroup);
    physics.addBoxCollider(new THREE.Vector3(rt.x, y + 1.2, rt.z), new THREE.Vector3(1.6, 1.2, 1.3));

    // Interactive Radio Generator
    this.interactables.push({
      id: 'radio_generator',
      type: 'radio_generator',
      prompt: 'Press [E] to Insert Fuses and Activate Radio Generator',
      position: new THREE.Vector3(rt.x, y + 1.2, rt.z + 1.6),
      radius: 3.0
    });
  }

  private buildQuarantineGate(textures: ReturnType<typeof getTextureAtlas>): void {
    const g = LAYOUT.gate;
    const y = getTerrainHeight(g.x, g.z);
    const gateGroup = new THREE.Group();
    gateGroup.position.set(g.x, y, g.z);

    const rustMat = new THREE.MeshStandardMaterial({
      map: textures.rustyMetal,
      roughness: 0.65,
      metalness: 0.8
    });

    // Massive Steel Blast Gate
    const gatePillarL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7, 1.2), rustMat);
    gatePillarL.position.set(-5, 3.5, 0);
    const gatePillarR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7, 1.2), rustMat);
    gatePillarR.position.set(5, 3.5, 0);

    const door = new THREE.Mesh(new THREE.BoxGeometry(8.8, 6.2, 0.4), rustMat);
    door.position.set(0, 3.1, 0);

    gateGroup.add(gatePillarL, gatePillarR, door);
    this.group.add(gateGroup);

    physics.addBoxCollider(new THREE.Vector3(g.x, y + 3.5, g.z), new THREE.Vector3(5.5, 3.5, 0.6));

    // Interactive Gate Access Terminal
    this.interactables.push({
      id: 'exit_gate',
      type: 'exit_gate',
      prompt: 'Press [E] to Unlock Quarantine Gate and Escape',
      position: new THREE.Vector3(g.x - 3.8, y + 1.4, g.z + 1.2),
      radius: 3.2
    });
  }

  private buildPoliceWreck(textures: ReturnType<typeof getTextureAtlas>): void {
    const w = LAYOUT.wreck;
    const y = getTerrainHeight(w.x, w.z);

    const carGroup = new THREE.Group();
    carGroup.position.set(w.x, y + 0.6, w.z);
    carGroup.rotation.y = 0.4;
    carGroup.rotation.z = -0.15; // Tilted into ditch

    const carMat = new THREE.MeshStandardMaterial({
      color: 0x1a2634,
      metalness: 0.7,
      roughness: 0.4
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.0, 4.2), carMat);
    carGroup.add(body);

    // Flickering hazard light
    const hazard = new THREE.PointLight(0xff6600, 1.5, 8);
    hazard.position.set(0.9, 0.4, 2.1);
    carGroup.add(hazard);

    this.group.add(carGroup);
    physics.addBoxCollider(new THREE.Vector3(w.x, y + 0.6, w.z), new THREE.Vector3(1.2, 0.8, 2.2));

    // Ammo pickup at trunk
    this.interactables.push({
      id: 'wreck_ammo',
      type: 'ammo',
      prompt: 'Press [E] to Take 9mm Pistol Ammo & Battery',
      position: new THREE.Vector3(w.x, y + 0.8, w.z - 2.2),
      radius: 2.5,
      data: { weapon: 'pistol', rounds: 16 }
    });
  }

  /** Check for nearby interactable object to display prompt and handle [E] press. */
  public checkNearby(playerPos: THREE.Vector3): InteractableItem | null {
    for (const item of this.interactables) {
      const dist = playerPos.distanceTo(item.position);
      if (dist <= item.radius) {
        return item;
      }
    }
    return null;
  }

  /** Execute interaction. */
  public triggerInteract(item: InteractableItem): void {
    const store = useGameStore.getState();
    soundEngine.playInteract();

    switch (item.type) {
      case 'fuse':
        store.collectFuse();
        if (item.mesh) item.mesh.visible = false;
        this.interactables = this.interactables.filter((i) => i.id !== item.id);
        break;

      case 'weapon':
        store.switchWeapon('shotgun');
        store.setAmmo({ shotgunMag: 2, shotgunReserve: store.shotgunReserve + 8 });
        store.setObjective('Restore power to the Radio Tower generator', 'Fuses are scattered in the Cabin, Chapel, and Lake Docks');
        if (item.mesh) item.mesh.visible = false;
        this.interactables = this.interactables.filter((i) => i.id !== item.id);
        break;

      case 'ammo':
        store.setAmmo({ pistolReserve: store.pistolReserve + 16 });
        store.useBatteryItem();
        this.interactables = this.interactables.filter((i) => i.id !== item.id);
        break;

      case 'medkit':
        store.heal(50);
        this.interactables = this.interactables.filter((i) => i.id !== item.id);
        break;

      case 'note':
        if (item.data) {
          store.readNote(item.data as NoteItem);
        }
        break;

      case 'radio_generator':
        if (store.fusesCollected >= 3) {
          store.setObjective('Escape through the Quarantine Gate!', 'The Radio Signal unlocked the Sector B-09 blast doors!');
          store.collectKey('gate');
          soundEngine.playFootstep(item.position, 'stone');
        } else {
          store.setObjective(
            `Radio Generator Offline: Needs ${3 - store.fusesCollected} more fuse(s)`,
            'Search the Cabin, Chapel Altar, and Lake Pier for high-voltage fuses'
          );
        }
        break;

      case 'exit_gate':
        if (store.hasKeyGate) {
          store.setStatus('victory');
        } else {
          store.setObjective(
            'Quarantine Gate Locked: Sector Lockdown Active',
            'You must activate the Radio Tower generator on the eastern ridge to override gate locks!'
          );
        }
        break;
    }
  }

  private spawnFloatingPickups(): void {
    const ammoMat = new THREE.MeshStandardMaterial({
      color: 0x3b6e38,
      emissive: 0x226618,
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.65
    });
    const medkitMat = new THREE.MeshStandardMaterial({
      color: 0xd8d8d8,
      emissive: 0x8a1c1c,
      emissiveIntensity: 0.75,
      roughness: 0.3,
      metalness: 0.2
    });
    const batteryMat = new THREE.MeshStandardMaterial({
      color: 0xd4ac0d,
      emissive: 0x9a7d0a,
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.5
    });

    const ammoGeo = new THREE.BoxGeometry(0.46, 0.28, 0.26);
    const medGeo = new THREE.BoxGeometry(0.44, 0.32, 0.44);
    const batGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.32, 8);

    const locations: { x: number; z: number; type: 'ammo' | 'medkit' | 'battery' }[] = [
      // Cabin area
      { x: LAYOUT.cabins[0].x - 3.5, z: LAYOUT.cabins[0].z + 3.5, type: 'ammo' },
      { x: LAYOUT.cabins[0].x + 4.5, z: LAYOUT.cabins[0].z - 2.5, type: 'medkit' },
      // Chapel
      { x: LAYOUT.chapel.x - 4, z: LAYOUT.chapel.z - 8, type: 'ammo' },
      { x: LAYOUT.chapel.x + 5, z: LAYOUT.chapel.z + 4, type: 'battery' },
      // Graveyard
      { x: LAYOUT.graveyard.x + 8, z: LAYOUT.graveyard.z - 6, type: 'ammo' },
      { x: LAYOUT.graveyard.x - 7, z: LAYOUT.graveyard.z + 5, type: 'medkit' },
      // Lake Dock
      { x: LAYOUT.lake.x - 28, z: LAYOUT.lake.z - 12, type: 'ammo' },
      { x: LAYOUT.lake.x - 14, z: LAYOUT.lake.z - 24, type: 'battery' },
      // Radio Tower
      { x: LAYOUT.radioTower.x - 6, z: LAYOUT.radioTower.z + 4, type: 'ammo' },
      { x: LAYOUT.radioTower.x + 5, z: LAYOUT.radioTower.z - 5, type: 'medkit' },
      // Police Wreck
      { x: LAYOUT.wreck.x + 4, z: LAYOUT.wreck.z + 3, type: 'ammo' },
      { x: LAYOUT.wreck.x - 4, z: LAYOUT.wreck.z - 3, type: 'battery' },
      // Near Spawn Road
      { x: LAYOUT.spawn.x + 6, z: LAYOUT.spawn.z - 12, type: 'ammo' },
      { x: LAYOUT.spawn.x - 8, z: LAYOUT.spawn.z - 8, type: 'medkit' }
    ];

    locations.forEach((loc, idx) => {
      const y = getTerrainHeight(loc.x, loc.z) + 0.65;
      let geo: THREE.BufferGeometry = ammoGeo;
      let mat: THREE.Material = ammoMat;

      if (loc.type === 'medkit') {
        geo = medGeo;
        mat = medkitMat;
      } else if (loc.type === 'battery') {
        geo = batGeo;
        mat = batteryMat;
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(loc.x, y, loc.z);
      mesh.castShadow = true;
      this.group.add(mesh);

      this.pickups.push({
        id: `pickup_${idx}`,
        type: loc.type,
        mesh,
        basePos: new THREE.Vector3(loc.x, y, loc.z),
        phase: idx * 1.3,
        collected: false
      });
    });
  }

  public updatePickups(elapsed: number, playerPos: THREE.Vector3): void {
    const store = useGameStore.getState();

    for (let i = 0; i < this.pickups.length; i++) {
      const pk = this.pickups[i];
      if (pk.collected) continue;

      pk.mesh.position.y = pk.basePos.y + Math.sin(elapsed * 2.8 + pk.phase) * 0.08;
      pk.mesh.rotation.y = elapsed * 1.4 + pk.phase;

      const dist = playerPos.distanceTo(pk.basePos);
      if (dist < 1.6) {
        pk.collected = true;
        pk.mesh.visible = false;
        soundEngine.playPickup();

        if (pk.type === 'ammo') {
          store.setAmmo({ pistolReserve: store.pistolReserve + 10, shotgunReserve: store.shotgunReserve + 4 });
          store.showHudBanner('+10 PISTOL & +4 SHOTGUN AMMO');
        } else if (pk.type === 'medkit') {
          store.heal(30);
          store.showHudBanner('+30 HEALTH RESTORED');
        } else if (pk.type === 'battery') {
          store.useBatteryItem();
          store.showHudBanner('+60% FLASHLIGHT BATTERY');
        }
      }
    }
  }
}
