/**
 * wireDevhook.ts — connects the live World (built once, at boot) to the `?dev=1`
 * read-back hook (`window.__ranger`, core/devhook.ts). Read-only state for
 * the browser tests; the one write (`winStep`) is the E2E shortcut the golden-path
 * test must never use.
 */

import type * as THREE from 'three';
import type { World } from '../../render3d/World';
import {
  providePos, provideCameraYaw, provideNearId, provideMarkers, provideBoard, provideSitSpot, providePorch,
  provideWinStep, provideClip, provideAvatar, provideGroundSpeed, provideMotion, provideGait, provideGrounded, provideCam,
  provideActors, provideAmbient, provideLandmarks, provideDressing, provideTreeSpots, provideObstacles, providePaths,
  provideGroundDetail, provideLighting, provideSky, provideFootsteps, provideWater, provideVehicle,
  provideHeli, provideQuality, provideBoundary, provideTags, provideMissionPlaces, provideResidents,
  provideGrowth, provideMood, provideAnimals, provideSurprise, renderView,
} from '../../core/devhook';
import { animalsSeen } from '../../render3d/AnimalDress';
import { store } from '../../core/state';
import { EF_ENGINES, floorLevel } from '../../core/skill';
import { adventureFor } from '../../render3d/adventure/registry';
import { triggerActivityWin } from '../../render3d/play/kit';

/** Expose the live world's read-backs on the dev hook. */
export function wireWorldDevhook(world: World): void {
  providePos(() => world.pos());
  provideCameraYaw(() => world.cameraYaw());
  provideNearId(() => world.nearMission());
  provideMarkers(() => world.markerPositions());
  provideBoard(() => world.boardState());
  provideBoundary(() => world.boundaryState());       // F-11: world-rim clamp + "Hier stopt het bos" cue
  provideSitSpot(() => world.sitSpotState());         // W6.4b2: "Ken je roep" sit-spot proximity
  providePorch(() => world.porchState());             // run 6: the hut's porch ring (the raaf)
  provideClip(() => world.playerClip());              // W3.2: the ranger's active locomotion clip
  provideAvatar(() => world.avatarState());           // F-07: live ranger scale (measured bbox height)
  provideGroundSpeed(() => world.groundSpeed());      // F-08: live post-collision foot speed (m/s)
  provideMotion(() => world.rangerMotion());          // run 6: where he is, his heading, speed, running
  provideGait(() => world.playerGait());              // run 6: his legs (clip, cadence, stride) + sole probe
  provideGrounded(() => world.groundedState());       // D1.2: feet on the rendered terrain
  provideCam(() => world.camState());                 // F-05 ⊕ F-18: the REAL render camera read-back
  provideActors(() => world.actorClips());            // W3.3: warden + poacher baked clips
  provideAmbient(() => world.ambientState());         // W3.6: roaming animals + gliding birds
  provideLandmarks(() => world.landmarkPositions());  // W4.1: fixed landmark beacons
  provideDressing(() => world.dressingPositions());   // W4.2: nature dressing props
  provideTreeSpots(() => world.treeSpotList());       // D1.5: scatter+rim tree placements
  provideObstacles(() => world.obstacleList());       // run 6: every static solid, as the jeep sees it
  providePaths(() => world.pathNetwork());            // W4.3: sand-path network
  provideGroundDetail(() => world.groundDetailState()); // W4.4: procedural ground albedo
  provideLighting(() => world.lightingState());       // W4.5: golden-hour light + shadows
  provideSky(() => world.skyState());                 // W4.6: sky gradient + cloud drift + wind
  provideFootsteps(() => world.footstepState());      // W4.7b: surface-aware footsteps
  provideWater(() => world.waterState());             // W4.8: fresnel ven-water
  provideVehicle(() => world.vehicleState());         // W5.1: drivable jeep
  provideHeli(() => world.heliState());               // W5.3b: opt-in helicopter
  provideQuality(() => world.qualityState());         // W7.2: adaptive quality tier
  provideTags(() => world.tagsOnScreen(), () => world.glowState()); // run 6: the tags drawn, the glowing cues
  provideWinStep(() => triggerActivityWin());         // W2.3: E2E-only resolve of a 3D step
  provideMissionPlaces((id) => { const p = adventureFor(id)?.home.places; return p ? { ...p } : null; }); // run 6
  provideResidents(() => world.residents.read(), () => world.residents.moverSpots()); // run 6: the homes
  provideMood(() => world.mood());                    // run 7: the session's mood, the one on screen
  provideSurprise(() => world.surpriseState());       // run 7 (veldgids): the open world's small surprises
  provideAnimals(() => {                              // run 7: the animals in the picture (read-only)
    const v = renderView() as { scene?: THREE.Scene; camera?: THREE.Camera } | null;
    const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
    return v?.scene && v.camera && canvas ? animalsSeen(v.scene, v.camera, canvas.clientWidth, canvas.clientHeight) : [];
  });
  // run 7: his growth and his finds, straight from the save (copies: reading never writes)
  provideGrowth({
    history: () => store.get().geschiedenis.map((b) => ({ ...b })),
    skills: () => Object.fromEntries(EF_ENGINES.map((e) => {
      const r = store.get().skill[e];
      return [e, { level: r.level, best: r.best, trials: r.trials, floor: Math.round(floorLevel(r.trials) * 1000) / 1000, knobs: store.knobs(e) }];
    })),
    discoveries: () => {
      const s = store.get();
      const found = Object.entries(s.ontdekt).sort((a, b) => a[1].t - b[1].t).map(([id]) => id);
      return { found, rareCounts: { ...s.zeldzaam } };
    },
  });
}
