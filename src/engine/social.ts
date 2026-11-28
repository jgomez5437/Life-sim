import type { GameClock, RelationshipTier, RomanceTier, SocialPost } from '../types/game';

export const RELATIONSHIP_TIER_META: Record<
  RelationshipTier,
  { label: string; color: string; bgTint: string }
> = {
  acquaintance: {
    label: 'Acquaintance',
    color: '#5c768d',
    bgTint: 'rgba(92, 118, 141, 0.14)',
  },
  friend: {
    label: 'Friend',
    color: '#1e9e6d',
    bgTint: 'rgba(30, 158, 109, 0.14)',
  },
  good_friend: {
    label: 'Good Friend',
    color: '#1b8fb0',
    bgTint: 'rgba(27, 143, 176, 0.16)',
  },
  best_friend: {
    label: 'Best Friend',
    color: '#d96c4f',
    bgTint: 'rgba(217, 108, 79, 0.16)',
  },
};

export const ROMANCE_TIER_META: Record<
  RomanceTier,
  { label: string; color: string; bgTint: string }
> = {
  none: {
    label: 'Just Friends',
    color: '#8894a0',
    bgTint: 'rgba(136, 148, 160, 0.12)',
  },
  crush: {
    label: 'Crush',
    color: '#d95d84',
    bgTint: 'rgba(217, 93, 132, 0.15)',
  },
  romantic_interest: {
    label: 'Romantic Interest',
    color: '#c9436f',
    bgTint: 'rgba(201, 67, 111, 0.16)',
  },
  partner: {
    label: 'Soulmate',
    color: '#b8295c',
    bgTint: 'rgba(184, 41, 92, 0.18)',
  },
};

export function clampRelationship(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getRelationshipTier(score: number): RelationshipTier {
  if (score >= 85) return 'best_friend';
  if (score >= 65) return 'good_friend';
  if (score >= 35) return 'friend';
  return 'acquaintance';
}

export function getRomanceTier(score: number): RomanceTier {
  if (score >= 80) return 'partner';
  if (score >= 45) return 'romantic_interest';
  if (score >= 12) return 'crush';
  return 'none';
}

export function createSocialPost(params: {
  id: string;
  authorName: string;
  authorColor: string;
  text: string;
  clock: GameClock;
  tag: SocialPost['tag'];
  likes?: number;
}): SocialPost {
  return {
    id: params.id,
    authorName: params.authorName,
    authorColor: params.authorColor,
    text: params.text,
    day: params.clock.day,
    hour: params.clock.hour,
    minute: params.clock.minute,
    likes: params.likes ?? 4 + ((params.clock.day * 7 + params.clock.minute) % 14),
    tag: params.tag,
  };
}
