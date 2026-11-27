import { CATALOG_BY_ID, SELF_INTERACTIONS } from '../data/catalog';
import type {
  AnimationPose,
  EmotionType,
  NeedKey,
  PlacedObject,
  SimNeeds,
  SimState,
  WallSegment,
} from '../types/game';
import { getBestInteractionSlot } from './grid';
import { findPath } from './pathfinding';

export const NEED_KEYS: NeedKey[] = ['hunger', 'energy', 'bladder', 'hygiene', 'fun', 'social'];

export const NEED_LABELS: Record<NeedKey, string> = {
  hunger: 'Hunger',
  energy: 'Energy',
  bladder: 'Bladder',
  hygiene: 'Hygiene',
  fun: 'Fun',
  social: 'Social',
};

/**
 * Per-Sim-minute decay rates tuned for engaging mobile play sessions.
 */
export const NEED_DECAY_PER_MINUTE: Record<NeedKey, number> = {
  hunger: 0.14,
  energy: 0.09,
  bladder: 0.17,
  hygiene: 0.08,
  fun: 0.13,
  social: 0.1,
};

export function clampNeed(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function decayNeeds(
  needs: SimNeeds,
  simMinutes: number,
  pose: AnimationPose,
): SimNeeds {
  return {
    hunger: clampNeed(needs.hunger - NEED_DECAY_PER_MINUTE.hunger * simMinutes * (pose === 'eat' ? 0.15 : pose === 'sleep' ? 0.45 : 1)),
    energy: clampNeed(needs.energy - NEED_DECAY_PER_MINUTE.energy * simMinutes * (pose === 'sleep' ? 0 : pose === 'sit' ? 0.4 : 1)),
    bladder: clampNeed(needs.bladder - NEED_DECAY_PER_MINUTE.bladder * simMinutes * (pose === 'sleep' ? 0.4 : 1)),
    hygiene: clampNeed(needs.hygiene - NEED_DECAY_PER_MINUTE.hygiene * simMinutes * (pose === 'wash' ? 0 : 1)),
    fun: clampNeed(needs.fun - NEED_DECAY_PER_MINUTE.fun * simMinutes * (pose === 'sleep' ? 0.2 : 1)),
    social: clampNeed(needs.social - NEED_DECAY_PER_MINUTE.social * simMinutes * (pose === 'sleep' ? 0.25 : 1)),
  };
}

export function applyNeedDeltas(
  needs: SimNeeds,
  deltas: Partial<Record<NeedKey, number>>,
  fraction: number,
): SimNeeds {
  const next = { ...needs };
  for (const key of NEED_KEYS) {
    const delta = deltas[key];
    if (delta !== undefined && delta !== 0) {
      next[key] = clampNeed(next[key] + delta * fraction);
    }
  }
  return next;
}

export function getAverageNeeds(needs: SimNeeds): number {
  return (
    (needs.hunger +
      needs.energy +
      needs.bladder +
      needs.hygiene +
      needs.fun +
      needs.social) /
    6
  );
}

export function computeEmotion(
  needs: SimNeeds,
  boost: { type: EmotionType; expiresAtSimMinute: number } | null,
  currentTotalMinutes: number,
): EmotionType {
  if (needs.energy < 20) return 'exhausted';
  if (needs.hunger < 22 || needs.bladder < 20 || needs.hygiene < 20) return 'uncomfortable';
  if (needs.fun < 24 || needs.social < 22) return 'tense';

  if (boost && currentTotalMinutes < boost.expiresAtSimMinute) {
    return boost.type;
  }

  const avg = getAverageNeeds(needs);
  if (avg >= 72) return 'happy';
  if (avg >= 48) return 'fine';
  return 'uncomfortable';
}

export const EMOTION_META: Record<
  EmotionType,
  { label: string; color: string; bgTint: string }
> = {
  happy: { label: 'Happy', color: '#1ea866', bgTint: 'rgba(30, 168, 102, 0.16)' },
  inspired: { label: 'Inspired', color: '#1b9aaa', bgTint: 'rgba(27, 154, 170, 0.16)' },
  energized: { label: 'Energized', color: '#39b54a', bgTint: 'rgba(57, 181, 74, 0.18)' },
  fine: { label: 'Fine', color: '#5c859e', bgTint: 'rgba(92, 133, 158, 0.14)' },
  uncomfortable: { label: 'Uncomfortable', color: '#e67e22', bgTint: 'rgba(230, 126, 34, 0.18)' },
  tense: { label: 'Tense', color: '#d9534f', bgTint: 'rgba(217, 83, 79, 0.18)' },
  exhausted: { label: 'Exhausted', color: '#c0392b', bgTint: 'rgba(192, 57, 43, 0.2)' },
};

export function getPlumbobColor(needs: SimNeeds, emotion: EmotionType): string {
  const minNeed = Math.min(
    needs.hunger,
    needs.energy,
    needs.bladder,
    needs.hygiene,
    needs.fun,
    needs.social,
  );
  if (minNeed < 22) return '#e74c3c';
  if (minNeed < 45) return '#f39c12';
  if (emotion === 'inspired') return '#22b8cf';
  if (emotion === 'energized') return '#40c057';
  return '#26c478';
}

export interface ScoredAutonomyCandidate {
  kind: 'object' | 'self';
  objectId?: string;
  interactionId: string;
  score: number;
}

/**
 * Utility-AI scorer evaluating all reachable placed furniture and phone/self actions.
 */
export function pickAutonomousAction(
  sim: SimState,
  placedObjects: PlacedObject[],
  walls: WallSegment[],
  funds: number,
  targetNeed?: NeedKey,
): ScoredAutonomyCandidate | null {
  const candidates: ScoredAutonomyCandidate[] = [];
  const simTile = { x: sim.tileX, z: sim.tileZ };

  const scoreNeedDeltas = (
    deltas: Partial<Record<NeedKey, number>>,
    distancePenalty: number,
    cost: number,
  ): number => {
    let score = 0;
    for (const key of NEED_KEYS) {
      const gain = deltas[key] ?? 0;
      if (targetNeed && key !== targetNeed) {
        if (gain < 0) score += gain * 0.05;
        continue;
      }
      if (gain > 0) {
        const deficit = (100 - sim.needs[key]) / 100;
        const urgency = targetNeed ? 1.5 + deficit : deficit * deficit;
        score += urgency * gain;
      } else if (gain < 0) {
        score += gain * 0.08;
      }
    }
    return score - distancePenalty - cost * 0.08;
  };

  // Evaluate placed furniture
  for (const obj of placedObjects) {
    const item = CATALOG_BY_ID[obj.catalogId];
    if (!item || item.interactions.length === 0) continue;

    const slot = getBestInteractionSlot(obj, item, placedObjects, walls, simTile);
    if (!slot) continue;

    // Quick distance estimate first; verify reachability before keeping best candidates
    const dist = Math.hypot(slot.tile.x - simTile.x, slot.tile.z - simTile.z);

    for (const interaction of item.interactions) {
      const cost = interaction.cost ?? 0;
      if (cost > funds) continue;
      if (targetNeed && (interaction.needDeltas[targetNeed] ?? 0) <= 0) continue;

      const score = scoreNeedDeltas(interaction.needDeltas, dist * 0.45, cost);
      if (score > (targetNeed ? 0 : 4.5)) {
        candidates.push({
          kind: 'object',
          objectId: obj.instanceId,
          interactionId: interaction.id,
          score,
        });
      }
    }
  }

  // Evaluate self/phone interactions
  for (const interaction of SELF_INTERACTIONS) {
    const cost = interaction.cost ?? 0;
    if (cost > funds) continue;
    if (targetNeed && (interaction.needDeltas[targetNeed] ?? 0) <= 0) continue;

    const score = scoreNeedDeltas(interaction.needDeltas, 0.2, cost);
    if (score > (targetNeed ? 0 : 4.5)) {
      candidates.push({
        kind: 'self',
        interactionId: interaction.id,
        score,
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);

  // Confirm A* path reachability for top object candidates
  for (const candidate of candidates) {
    if (candidate.kind === 'self') return candidate;
    const obj = placedObjects.find((o) => o.instanceId === candidate.objectId);
    if (!obj) continue;
    const item = CATALOG_BY_ID[obj.catalogId];
    if (!item) continue;
    const slot = getBestInteractionSlot(obj, item, placedObjects, walls, simTile);
    if (!slot) continue;
    const path = findPath(simTile, slot.tile, placedObjects, walls);
    if (path !== null) {
      return candidate;
    }
  }

  return null;
}

export function formatSimTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const paddedMin = String(minute).padStart(2, '0');
  return `${displayHour}:${paddedMin} ${period}`;
}
