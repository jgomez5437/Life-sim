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

  it('resets Sim pose and advances queue cleanly when selling or moving an object currently in use', () => {
    const store = useGameStore.getState();
    store.resetStarterLot();

    // Queue sitting on sofa, then walking to patio
    expect(useGameStore.getState().enqueueObjectInteraction('obj_sofa_1', 'relax_sofa')).toBe(true);
    expect(useGameStore.getState().enqueueWalk({ x: 6, z: 12 })).toBe(true);

    // Transition sofa interaction into active performing phase
    useGameStore.getState().beginPerformingActiveAction();
    expect(useGameStore.getState().sim.pose).toBe('sit');
    expect(useGameStore.getState().sim.activeObjectId).toBe('obj_sofa_1');

    // Enter Build Mode and sell the sofa while Maya is sitting on it
    useGameStore.getState().setMode('build');
    useGameStore.getState().startMoveObject('obj_sofa_1');
    expect(useGameStore.getState().sellSelectedObject()).toBe(true);

    const afterSell = useGameStore.getState();
    expect(afterSell.sim.pose).toBe('idle');
    expect(afterSell.sim.activeObjectId).toBeNull();
    expect(afterSell.actionQueue.length).toBe(1);
    expect(afterSell.actionQueue[0].kind).toBe('walk');
    expect(afterSell.actionQueue[0].path.length).toBeGreaterThan(0);
  });

  it('re-validates queued paths when returning from Build Mode after placing an obstacle', () => {
    const store = useGameStore.getState();
    store.resetStarterLot();

    // Queue walk to (6, 6), then chain a self interaction
    expect(useGameStore.getState().enqueueWalk({ x: 6, z: 6 })).toBe(true);
    expect(useGameStore.getState().enqueueSelfInteraction('call_friend')).toBe(true);
    expect(useGameStore.getState().actionQueue[1].targetTile).toEqual({ x: 6, z: 6 });

    // Enter Build Mode and place a potted plant right on (6, 6)
    useGameStore.getState().setMode('build');
    useGameStore.getState().startBuildItem('monstera_plant');
    useGameStore.getState().updateBuildGhost(6, 6);
    expect(useGameStore.getState().confirmBuildPlacement()).toBe(true);

    // Return to Live Mode: unreachable walk to (6,6) should be dropped, advancing to call_friend
    useGameStore.getState().setMode('live');
    const state = useGameStore.getState();
    expect(state.actionQueue.length).toBe(1);
    expect(state.actionQueue[0].kind).toBe('self');
    expect(state.actionQueue[0].interactionId).toBe('call_friend');
  });

  it('routes Maya to Bedroom Dresser, Arch Mirror, or Vanity Sink to open Wardrobe Studio and restores speed on close', () => {
    const store = useGameStore.getState();
    store.resetStarterLot();
    useGameStore.getState().setSpeed(3);

    // Queue Plan Outfits on Bedroom Dresser
    expect(useGameStore.getState().enqueueObjectInteraction('obj_dresser_1', 'plan_outfits')).toBe(
      true,
    );
    expect(useGameStore.getState().actionQueue[0].opensWardrobe).toBe(true);

    // Arriving at dresser opens Wardrobe Studio, pauses sim clock, and clears the wardrobe action
    useGameStore.getState().beginPerformingActiveAction();
    let state = useGameStore.getState();
    expect(state.wardrobeOpen).toBe(true);
    expect(state.speed).toBe(0);
    expect(state.actionQueue.length).toBe(0);

    // Live appearance updates apply cleanly
    useGameStore.getState().updateSimAppearance({
      hairStyle: 'waves',
      eyeColor: '#2f6f99',
      topColor: '#5d9379',
    });
    expect(useGameStore.getState().sim.appearance.hairStyle).toBe('waves');
    expect(useGameStore.getState().sim.appearance.eyeColor).toBe('#2f6f99');
    expect(useGameStore.getState().sim.appearance.topColor).toBe('#5d9379');

    // Closing Wardrobe Studio restores prior live speed (3x)
    useGameStore.getState().closeWardrobe(true);
    state = useGameStore.getState();
    expect(state.wardrobeOpen).toBe(false);
    expect(state.speed).toBe(3);

    // Also verify Arch Mirror and Bathroom Vanity Sink can open Wardrobe Studio
    expect(useGameStore.getState().enqueueObjectInteraction('obj_mirror_1', 'change_appearance')).toBe(
      true,
    );
    useGameStore.getState().beginPerformingActiveAction();
    expect(useGameStore.getState().wardrobeOpen).toBe(true);
    useGameStore.getState().closeWardrobe(false);

    expect(useGameStore.getState().enqueueObjectInteraction('obj_sink_1', 'change_appearance')).toBe(
      true,
    );
    useGameStore.getState().beginPerformingActiveAction();
    expect(useGameStore.getState().wardrobeOpen).toBe(true);
    useGameStore.getState().closeWardrobe(false);
  });

  it('never picks wardrobe-opening dresser/mirror interactions autonomously via Free Will', () => {
    const sim = createInitialSim();
    // Neutral needs where fun/hygiene/social might look attractive
    sim.needs = {
      hunger: 75,
      energy: 75,
      bladder: 75,
      hygiene: 75,
      fun: 75,
      social: 75,
    };

    for (let i = 0; i < 15; i += 1) {
      const pick = pickAutonomousAction(sim, STARTER_OBJECTS, STARTER_WALLS, 1000);
      expect(pick?.interactionId).not.toBe('plan_outfits');
      expect(pick?.interactionId).not.toBe('change_appearance');
    }
  });

  it('tracks held props during active interactions and clears them on completion or cancellation', () => {
    const store = useGameStore.getState();
    store.resetStarterLot();

    expect(useGameStore.getState().enqueueSelfInteraction('call_friend')).toBe(true);
    useGameStore.getState().beginPerformingActiveAction();
    expect(useGameStore.getState().sim.activeProp).toBe('phone');

    // Completing the action clears activeProp
    useGameStore.getState().tickSimMinutes(25);
    expect(useGameStore.getState().sim.activeProp).toBeNull();

    // Graphics quality toggle updates store cleanly
    useGameStore.getState().setGraphicsQuality('balanced');
    expect(useGameStore.getState().graphicsQuality).toBe('balanced');
    useGameStore.getState().setGraphicsQuality('high');
    expect(useGameStore.getState().graphicsQuality).toBe('high');
  });
});
