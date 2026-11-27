import { describe, expect, it } from 'vitest';
import { STARTER_OBJECTS, STARTER_WALLS, createInitialSim } from '../../data/starterLot';
import {
  applyNeedDeltas,
  computeEmotion,
  decayNeeds,
  getPlumbobColor,
  pickAutonomousAction,
} from '../simulation';
import { useGameStore } from '../../store/gameStore';

describe('needs decay, emotion calculation, autonomy, and store economy', () => {
  it('decays needs accurately and pauses energy decay while sleeping', () => {
    const sim = createInitialSim();
    const afterIdle = decayNeeds(sim.needs, 30, 'idle');
    expect(afterIdle.hunger).toBeLessThan(sim.needs.hunger);
    expect(afterIdle.energy).toBeLessThan(sim.needs.energy);

    const afterSleep = decayNeeds(sim.needs, 30, 'sleep');
    expect(afterSleep.energy).toBe(sim.needs.energy);
    expect(afterSleep.hunger).toBeGreaterThan(afterIdle.hunger);
  });

  it('resolves emotions and Plumbob color from need thresholds and active boosts', () => {
    const sim = createInitialSim();
    expect(computeEmotion(sim.needs, null, 600)).toBe('happy');
    expect(getPlumbobColor(sim.needs, 'happy')).toBe('#26c478');

    const inspired = computeEmotion(
      sim.needs,
      { type: 'inspired', expiresAtSimMinute: 700 },
      620,
    );
    expect(inspired).toBe('inspired');
    expect(getPlumbobColor(sim.needs, inspired)).toBe('#22b8cf');

    const critical = { ...sim.needs, bladder: 12 };
    expect(computeEmotion(critical, null, 620)).toBe('uncomfortable');
    expect(getPlumbobColor(critical, 'uncomfortable')).toBe('#e74c3c');
  });

  it('utility AI prioritizes the most urgent need when selecting an autonomous action', () => {
    const sim = createInitialSim();
    sim.needs = {
      hunger: 85,
      energy: 85,
      bladder: 10,
      hygiene: 85,
      fun: 85,
      social: 85,
    };

    const pick = pickAutonomousAction(sim, STARTER_OBJECTS, STARTER_WALLS, 1000);
    expect(pick).not.toBeNull();
    expect(pick?.kind).toBe('object');
    expect(pick?.interactionId).toBe('use_toilet');
  });

  it('handles Build/Buy purchase, move, and 80% refund transactions cleanly in the store', () => {
    const store = useGameStore.getState();
    store.resetStarterLot();

    const startFunds = useGameStore.getState().funds;
    const startCount = useGameStore.getState().placedObjects.length;

    useGameStore.getState().setMode('build');
    useGameStore.getState().startBuildItem('monstera_plant');
    useGameStore.getState().updateBuildGhost(1, 1);

    const placed = useGameStore.getState().confirmBuildPlacement();
    expect(placed).toBe(true);
    expect(useGameStore.getState().funds).toBe(startFunds - 85);
    expect(useGameStore.getState().placedObjects.length).toBe(startCount + 1);

    // Pick up newly placed plant and sell for 80% refund (§68)
    const newest = useGameStore.getState().placedObjects[startCount];
    useGameStore.getState().startMoveObject(newest.instanceId);
    const sold = useGameStore.getState().sellSelectedObject();
    expect(sold).toBe(true);
    expect(useGameStore.getState().placedObjects.length).toBe(startCount);
    expect(useGameStore.getState().funds).toBe(startFunds - 85 + Math.round(85 * 0.8));

    // Confirm need delta clamping
    const boosted = applyNeedDeltas(createInitialSim().needs, { hunger: 95 }, 1);
    expect(boosted.hunger).toBe(100);
  });
});
