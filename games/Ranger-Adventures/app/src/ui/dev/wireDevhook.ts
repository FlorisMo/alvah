/**
 * wireDevhook.ts — connects the live World (built once, at boot) to the `?dev=1`
 * read-back hook (`window.__ranger`, core/devhook.ts). Read-only state for
 * the browser tests; the one write (`winStep`) is the E2E shortcut the golden-path
 * test must never use.
 */

import type { World } from '../../render3d/World';
import {
  providePos, provideCameraYaw, provideNearId, provideMarkers, provideBoard, provideSitSpot,
  provideWinStep, provideClip, provideAvatar, provideGroundSpeed, provideGrounded, provideCam,
  provideActors, provideAmbient, provideLandmarks, provideDressing, provideTreeSpots, providePaths,
  provideGroundDetail, provideLighting, provideSky, provideFootsteps, provideWater, provideVehicle,
  provideHeli, provideQuality, provideBoundary,
} from '../../core/devhook';
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
  provideClip(() => world.playerClip());              // W3.2: the ranger's active locomotion clip
  provideAvatar(() => world.avatarState());           // F-07: live ranger scale (measured bbox height)
  provideGroundSpeed(() => world.groundSpeed());      // F-08: live post-collision foot speed (m/s)
  provideGrounded(() => world.groundedState());       // D1.2: feet on the rendered terrain
  provideCam(() => world.camState());                 // F-05 ⊕ F-18: the REAL render camera read-back
  provideActors(() => world.actorClips());            // W3.3: warden + poacher baked clips
  provideAmbient(() => world.ambientState());         // W3.6: roaming animals + gliding birds
  provideLandmarks(() => world.landmarkPositions());  // W4.1: fixed landmark beacons
  provideDressing(() => world.dressingPositions());   // W4.2: nature dressing props
  provideTreeSpots(() => world.treeSpotList());       // D1.5: scatter+rim tree placements
  providePaths(() => world.pathNetwork());            // W4.3: sand-path network
  provideGroundDetail(() => world.groundDetailState()); // W4.4: procedural ground albedo
  provideLighting(() => world.lightingState());       // W4.5: golden-hour light + shadows
  provideSky(() => world.skyState());                 // W4.6: sky gradient + cloud drift + wind
  provideFootsteps(() => world.footstepState());      // W4.7b: surface-aware footsteps
  provideWater(() => world.waterState());             // W4.8: fresnel ven-water
  provideVehicle(() => world.vehicleState());         // W5.1: drivable jeep
  provideHeli(() => world.heliState());               // W5.3b: opt-in helicopter
  provideQuality(() => world.qualityState());         // W7.2: adaptive quality tier
  provideWinStep(() => triggerActivityWin());         // W2.3: E2E-only resolve of a 3D step
}
