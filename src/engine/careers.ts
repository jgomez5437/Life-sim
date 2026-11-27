import { CAREERS_BY_ID } from '../data/careers';
import type {
  CareerDef,
  CareerLevelDef,
  CareerTrackId,
  ChanceCardDef,
  EmotionType,
  GameClock,
  SimCareerState,
  SimNeeds,
  WfhTaskProgress,
  WorkTone,
} from '../types/game';
import { clampNeed } from './simulation';

export const DAY_SHORT_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export const COMMUTE_STREET_TILE = { x: 6, z: 15 } as const;
export const RETURN_HOME_TILE = { x: 6, z: 11 } as const;

export interface WorkToneMeta {
  id: WorkTone;
  label: string;
  shortLabel: string;
  description: string;
  perfMultiplier: number;
  /** Per-Sim-minute deltas applied while Maya is off-lot at work. */
  needPerMinute: Record<keyof SimNeeds, number>;
}

export const WORK_TONES: Record<WorkTone, WorkToneMeta> = {
  normal: {
    id: 'normal',
    label: 'Work Normally',
    shortLabel: 'Normal',
    description: 'Balanced effort & steady performance',
    perfMultiplier: 1.0,
    needPerMinute: {
      hunger: -0.075,
      energy: -0.07,
      bladder: -0.04,
      hygiene: -0.045,
      fun: -0.055,
      social: -0.02,
    },
  },
  work_hard: {
    id: 'work_hard',
    label: 'Work Hard',
    shortLabel: 'Work Hard',
    description: '+45% perf, drains Fun & Energy faster',
    perfMultiplier: 1.45,
    needPerMinute: {
      hunger: -0.095,
      energy: -0.115,
      bladder: -0.05,
      hygiene: -0.06,
      fun: -0.135,
      social: -0.045,
    },
  },
  take_easy: {
    id: 'take_easy',
    label: 'Take It Easy',
    shortLabel: 'Take Easy',
    description: 'Boosts Fun & saves Energy, slower perf',
    perfMultiplier: 0.65,
    needPerMinute: {
      hunger: -0.055,
      energy: -0.035,
      bladder: -0.035,
      hygiene: -0.03,
      fun: 0.085,
      social: 0.01,
    },
  },
  socialize: {
    id: 'socialize',
    label: 'Chat w/ Coworkers',
    shortLabel: 'Socialize',
    description: 'Restores Social need while working',
    perfMultiplier: 0.82,
    needPerMinute: {
      hunger: -0.065,
      energy: -0.065,
      bladder: -0.04,
      hygiene: -0.04,
      fun: 0.03,
      social: 0.145,
    },
  },
};

export const WORK_TONE_LIST: WorkToneMeta[] = [
  WORK_TONES.normal,
  WORK_TONES.work_hard,
  WORK_TONES.take_easy,
  WORK_TONES.socialize,
];

export function getDayOfWeek(day: number): number {
  return (((day - 1) % 7) + 7) % 7;
}

export function getDayShortName(day: number): string {
  return DAY_SHORT_NAMES[getDayOfWeek(day)];
}

export function getCareerLevel(careerId: CareerTrackId, level: number): CareerLevelDef {
  const career = CAREERS_BY_ID[careerId];
  const idx = Math.max(0, Math.min(career.levels.length - 1, level - 1));
  return career.levels[idx];
}

export function getNextCareerLevel(careerId: CareerTrackId, level: number): CareerLevelDef | null {
  const career = CAREERS_BY_ID[careerId];
  if (level >= career.levels.length) return null;
  return career.levels[level];
}

export function isWorkday(levelDef: CareerLevelDef, day: number): boolean {
  return levelDef.workDays.includes(getDayOfWeek(day));
}

export function getShiftWindowForDay(
  levelDef: CareerLevelDef,
  day: number,
): { startTotalMinutes: number; endTotalMinutes: number } {
  const dayStart = (day - 1) * 24 * 60;
  const startTotalMinutes = dayStart + levelDef.shiftStartHour * 60;
  const endTotalMinutes = startTotalMinutes + levelDef.shiftDurationHours * 60;
  return { startTotalMinutes, endTotalMinutes };
}

export function getMinutesUntilNextShift(
  levelDef: CareerLevelDef,
  clock: GameClock,
  skipToday = false,
): number {
  const now = clock.totalMinutes;
  for (let offset = 0; offset <= 7; offset += 1) {
    const checkDay = clock.day + offset;
    if (offset === 0 && skipToday) continue;
    if (!isWorkday(levelDef, checkDay)) continue;
    const { startTotalMinutes, endTotalMinutes } = getShiftWindowForDay(levelDef, checkDay);
    if (now < startTotalMinutes) {
      return Math.ceil(startTotalMinutes - now);
    }
    if (offset === 0 && now >= startTotalMinutes && now < endTotalMinutes) {
      return 0;
    }
  }
  return 24 * 60;
}

export function formatHour12(hour24: number): string {
  const normalized = ((hour24 % 24) + 24) % 24;
  const period = normalized >= 12 ? 'PM' : 'AM';
  const h = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${h}:00 ${period}`;
}

export function formatShiftHours(startHour: number, durationHours: number): string {
  return `${formatHour12(startHour)} – ${formatHour12(startHour + durationHours)}`;
}

export function formatTimeUntilShift(minutes: number): string {
  if (minutes <= 0) return 'Shift Active Now';
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = Math.floor(minutes % 60);
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

export function applyWorkShiftNeedTick(
  needs: SimNeeds,
  simMinutes: number,
  tone: WorkTone,
): SimNeeds {
  const rates = WORK_TONES[tone].needPerMinute;
  // Workplace restrooms & water coolers keep critical survival needs above emergency floor
  const floorClamp = (val: number, floor: number) => Math.max(floor, clampNeed(val));
  return {
    hunger: floorClamp(needs.hunger + rates.hunger * simMinutes, 14),
    energy: floorClamp(needs.energy + rates.energy * simMinutes, 10),
    bladder: floorClamp(needs.bladder + rates.bladder * simMinutes, 18),
    hygiene: floorClamp(needs.hygiene + rates.hygiene * simMinutes, 15),
    fun: clampNeed(needs.fun + rates.fun * simMinutes),
    social: clampNeed(needs.social + rates.social * simMinutes),
  };
}

export function computeShiftPerformanceDelta(
  simMinutes: number,
  shiftDurationMinutes: number,
  tone: WorkTone,
  emotion: EmotionType,
  idealEmotion: EmotionType,
  dailyTaskComplete: boolean,
): number {
  if (shiftDurationMinutes <= 0 || simMinutes <= 0) return 0;
  // A full normal shift yields ~40 perf points, letting engaged players earn promotions every ~2 shifts
  const baseFullShiftGain = 40;
  const fraction = simMinutes / shiftDurationMinutes;

  let moodMult = 1.0;
  if (emotion === idealEmotion) {
    moodMult = 1.25;
  } else if (emotion === 'happy' || emotion === 'inspired' || emotion === 'energized') {
    moodMult = 1.12;
  } else if (emotion === 'uncomfortable' || emotion === 'tense' || emotion === 'exhausted') {
    moodMult = 0.72;
  }

  const dailyTaskMult = dailyTaskComplete ? 1.2 : 1.0;
  const toneMult = WORK_TONES[tone].perfMultiplier;

  return baseFullShiftGain * fraction * moodMult * dailyTaskMult * toneMult;
}

export function createInitialCareerState(careerId: CareerTrackId, currentDay: number): SimCareerState {
  return {
    careerId,
    level: 1,
    performance: 20,
    dailyTaskProgress: 0,
    ptoDays: 1,
    shiftsCompleted: 0,
    totalEarned: 0,
    activeDayMarker: currentDay,
    shiftChoiceForDay: null,
    promptShownForDay: 0,
    wfhActive: false,
    wfhTasks: [],
    wfhPaidToday: false,
  };
}

export function generateWfhTasksForDay(career: CareerDef): WfhTaskProgress[] {
  // Select 2 distinct tasks from the career's WFH pool for crisp, doable home shifts
  const selected = career.wfhTaskPool.slice(0, 2);
  return selected.map((rule) => ({
    ruleId: rule.id,
    label: rule.label,
    hint: rule.hint,
    matchingInteractionIds: [...rule.matchingInteractionIds],
    progress: 0,
    targetCount: rule.targetCount,
  }));
}

export function pickChanceCardForCareer(careerId: CareerTrackId, seed: number): ChanceCardDef {
  const career = CAREERS_BY_ID[careerId];
  const idx = Math.abs(Math.floor(seed)) % career.chanceCards.length;
  return career.chanceCards[idx];
}

export function canPromote(careerState: SimCareerState, levelDef: CareerLevelDef): boolean {
  if (careerState.performance < 100) return false;
  if (careerState.dailyTaskProgress < levelDef.dailyTask.targetCount) return false;
  return getNextCareerLevel(careerState.careerId, careerState.level) !== null;
}

export function computeShiftPay(levelDef: CareerLevelDef, workedMinutes: number): number {
  const hours = Math.min(levelDef.shiftDurationHours, Math.max(0, workedMinutes / 60));
  return Math.round(hours * levelDef.hourlyPay);
}
