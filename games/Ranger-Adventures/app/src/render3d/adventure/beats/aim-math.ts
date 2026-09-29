/**
 * beats/aim-math.ts — the pure part of the AIM beat (wisselen in the world, design
 * run6-missions §4.3 beat 3, §6): what the world does for each pick, over the SAME pure
 * `WisselRun` the 2D floor and the 3D stage drive. THREE-free, unit-tested.
 *
 * The child aims a camera trap at one of two named places for each animal that comes
 * by: the open glade (`open`) or the thicket (`hol`). The rule is the content's
 * ("Dag-dier → open plek. Nacht-dier → het bosje."); when it flips, the day turns into
 * night (and back): night animals come out into the open, day animals rest in the
 * thicket. So `night` is exactly the run's `inverted`, and the sky is its second channel.
 */

import { WisselRun, dagOfNacht, placeNames, regelAndersom, type WisselBin, type WisselItem, type WisselTrial } from '../../../engines/wisselen.ts';
import type { BeatSummary } from '../../../core/skill.ts';

/** What the world shows for one pick. */
export interface AimStep {
  /** where the camera turns (always the place he clicked) */
  look: WisselBin;
  /** `photo`: the animal walks in there, click; `empty`: an empty photo, the same animal
   *  again; the day turns after the photo when `turn` is set; `done` after the last */
  shot: 'photo' | 'empty';
  /** the day turns (the rule flipped): to night, or back to day */
  turn: 'night' | 'day' | null;
  done: boolean;
}

/** The aim run: the pure core plus the world's reading of it. */
export class AimRun {
  readonly run: WisselRun;
  readonly names: { open: string; hol: string };
  private readonly regel: string;

  constructor(trial: WisselTrial, regel: string) {
    this.run = new WisselRun(trial);
    this.regel = regel;
    this.names = placeNames(regel);
  }

  /** The animal that comes by now (undefined once all are photographed). */
  get current(): WisselItem | undefined { return this.run.current; }

  /** It is night now (the rule is flipped). */
  get night(): boolean { return this.run.inverted; }

  /** The rule as it stands now, said outright. */
  get rule(): string { return this.run.inverted ? regelAndersom(this.regel) : this.regel; }

  /** The rule as two chips with their icons (the card shows them): "☀️ Dag-dier → …". */
  get chips(): [string, string] { return ruleChips(this.rule); }

  /** The place a perfect player picks now. */
  get right(): WisselBin { return this.run.correctBin(); }

  /** He clicked `bin`. */
  pick(bin: WisselBin): AimStep {
    const was = this.run.inverted;
    const res = this.run.choose(bin);
    if (res === 'retry') return { look: bin, shot: 'empty', turn: null, done: false };
    const turned = this.run.inverted !== was;
    return { look: bin, shot: 'photo', turn: turned ? (this.run.inverted ? 'night' : 'day') : null, done: res === 'complete' };
  }

  summary(): BeatSummary { return this.run.summary(); }
}

/** A rule line ("Dag-dier → open plek. Nacht-dier → het bosje.") as two chips with the
 *  day/night icons in front (dagOfNacht: the same icon + word the animal's tag shows). */
export function ruleChips(rule: string): [string, string] {
  const parts = rule.split(/(?<=\.)\s+/).map((s) => s.replace(/\.$/, '').trim()).filter(Boolean);
  const icon = (s: string): string => (/^dag/i.test(s) ? dagOfNacht(true).icoon : dagOfNacht(false).icoon);
  const a = parts[0] ?? '', b = parts[1] ?? '';
  return [`${icon(a)} ${a}`, `${icon(b)} ${b}`];
}
