/**
 * Missions.ts — the world graph's entry (loaded by main.ts at boot, behind the veil).
 *
 * The flow lives in small modules:
 *   flow/WorldSession.ts  build / resume / leave the free-roam world
 *   flow/MissionFlow.ts   briefing → steps → fact → reward → clue → patrol
 *   hud/ExploreHud.ts     Pauze pill, wayfinding chip, proximity prompts, hints
 *   hub/Hub.ts            pause hub, missiebord, prikbord, badges, title
 *   dev/wireDevhook.ts    the `?dev=1` read-back wiring
 *   flow/session.ts       the shared host/stage/world + card helpers
 */

import './missions.css';

export { bootWorld } from './flow/WorldSession';
