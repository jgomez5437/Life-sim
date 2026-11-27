import { beforeEach, describe, expect, it } from 'vitest';
import { CAREERS_BY_ID } from '../../data/careers';
import { createInitialSim } from '../../data/starterLot';
import {
  applyWorkShiftNeedTick,
  computeShiftPerformanceDelta,
  formatTimeUntilShift,
  getCareerLevel,
  getDayOfWeek,
  getDayShortName,
  getMinutesUntilNextShift,
  isWorkday,
} from '../careers';
import { getRelationshipTier } from '../social';
import { useGameStore } from '../../store/gameStore';

describe('career engine helpers, work tones, and relationship tiers', () => {
  it('computes day-of-week schedules and countdowns accurately', () => {
    expect(getDayOfWeek(1)).toBe(0);
    expect(getDayShortName(1)).toBe('Mon');
    expect(getDayShortName(6)).toBe('Sat');
    expect(getDayShortName(7)).toBe('Sun');

    const culinaryLv1 = getCareerLevel('culinary', 1); // Mon-Fri, 10:00-16:00
    expect(isWorkday(culinaryLv1, 1)).toBe(true);
    expect(isWorkday(culinaryLv1, 6)).toBe(false);

    const mins = getMinutesUntilNextShift(culinaryLv1, {
      day: 1,
      hour: 9,
      minute: 0,
      totalMinutes: 9 * 60,
    });
    expect(mins).toBe(60);
    expect(formatTimeUntilShift(mins)).toBe('1h');
  });

  it('applies work tone need shifts and performance multipliers cleanly', () => {
    const baseNeeds = createInitialSim().needs;
    const hardNeeds = applyWorkShiftNeedTick(baseNeeds, 60, 'work_hard');
    const easyNeeds = applyWorkShiftNeedTick(baseNeeds, 60, 'take_easy');
    const socialNeeds = applyWorkShiftNeedTick(baseNeeds, 60, 'socialize');

    expect(hardNeeds.fun).toBeLessThan(baseNeeds.fun);
    expect(easyNeeds.fun).toBeGreaterThan(baseNeeds.fun);
    expect(socialNeeds.social).toBeGreaterThan(baseNeeds.social);

    const normalPerf = computeShiftPerformanceDelta(60, 360, 'normal', 'fine', 'inspired', false);
    const hardIdealPerf = computeShiftPerformanceDelta(
      60,
      360,
      'work_hard',
      'inspired',
      'inspired',
      true,
    );
    expect(hardIdealPerf).toBeGreaterThan(normalPerf * 2);
  });

  it('classifies NPC relationship tiers properly', () => {
    expect(getRelationshipTier(20)).toBe('acquaintance');
    expect(getRelationshipTier(45)).toBe('friend');
    expect(getRelationshipTier(75)).toBe('good_friend');
    expect(getRelationshipTier(90)).toBe('best_friend');
  });
});

describe('smartphone, social, delivery, and job system store flows', () => {
  beforeEach(() => {
    useGameStore.getState().resetStarterLot();
  });

  it('supports joining a career, rabbit-hole shift commute, chance card, paycheck, and returning home', () => {
    // Starter clock is Day 1 (Mon) at 9:00 AM; Culinary lv1 shift is 10:00 AM - 4:00 PM (§28/hr)
    useGameStore.getState().joinCareer('culinary');
    let state = useGameStore.getState();
    expect(state.career?.careerId).toBe('culinary');
    expect(state.career?.level).toBe(1);
    expect(state.shiftPrompt).not.toBeNull(); // Within 60 min of 10:00 AM shift

    // Choose Go to Work -> queues commute at 9:00 AM or schedules it at 10:00 AM
    expect(useGameStore.getState().goToWorkNow()).toBe(true);
    expect(useGameStore.getState().actionQueue[0].kind).toBe('commute');

    // Arrive at street edge -> Maya goes off-lot and shift begins
    useGameStore.getState().beginPerformingActiveAction();
    state = useGameStore.getState();
    expect(state.sim.awayAtWork).toBe(true);
    expect(state.activeShift).not.toBeNull();
    expect(state.enqueueWalk({ x: 6, z: 7 })).toBe(false); // Blocked while at work

    // Switch work tone to Work Hard
    useGameStore.getState().setWorkTone('work_hard');
    expect(useGameStore.getState().activeShift?.tone).toBe('work_hard');

    // Advance past midpoint (~45% of 7h from 9:00 to 16:00 -> 210 mins) to trigger mid-shift Chance Card
    useGameStore.getState().tickSimMinutes(210);
    state = useGameStore.getState();
    expect(state.activeChanceCard).not.toBeNull();
    expect(state.speed).toBe(0);

    const fundsBeforeCard = state.funds;
    useGameStore.getState().resolveChanceCard(0);
    expect(useGameStore.getState().activeChanceCard?.resolvedOptionIndex).toBe(0);
    expect(useGameStore.getState().funds).toBeGreaterThanOrEqual(fundsBeforeCard);
    useGameStore.getState().dismissChanceCard();
    expect(useGameStore.getState().activeChanceCard).toBeNull();
    expect(useGameStore.getState().speed).toBe(1);

    // Advance remainder of shift to completion
    const fundsBeforePay = useGameStore.getState().funds;
    useGameStore.getState().tickSimMinutes(250);
    state = useGameStore.getState();
    expect(state.sim.awayAtWork).toBe(false);
    expect(state.activeShift).toBeNull();
    expect(state.funds).toBeGreaterThan(fundsBeforePay);
    expect(state.career?.shiftsCompleted).toBe(1);
    expect(state.career?.ptoDays).toBeGreaterThan(1);
    expect(state.career?.shiftChoiceForDay).toBe('completed');
  });

  it('tracks Daily Prep Tasks and promotes Maya with bonus pay when performance hits 100%', () => {
    useGameStore.getState().joinCareer('culinary');

    // Complete Culinary Lv1 daily task (Cook Basil Pasta on Stove)
    expect(useGameStore.getState().enqueueObjectInteraction('obj_stove_1', 'cook_pasta')).toBe(
      true,
    );
    useGameStore.getState().beginPerformingActiveAction();
    useGameStore.getState().tickSimMinutes(38);
    expect(useGameStore.getState().career?.dailyTaskProgress).toBe(1);

    // Boost performance close to 100 and work a shift to cross promotion threshold
    useGameStore.setState((s) => ({
      career: s.career ? { ...s.career, performance: 90 } : null,
    }));
    expect(useGameStore.getState().goToWorkNow()).toBe(true);
    useGameStore.getState().beginPerformingActiveAction();
    // Skip chance card cleanly and finish shift
    useGameStore.getState().tickSimMinutes(220);
    if (useGameStore.getState().activeChanceCard) {
      useGameStore.getState().resolveChanceCard(1);
      useGameStore.getState().dismissChanceCard();
    }
    const fundsBeforePromo = useGameStore.getState().funds;
    useGameStore.getState().tickSimMinutes(220);

    const state = useGameStore.getState();
    expect(state.career?.level).toBe(2);
    expect(state.promotionSummary).not.toBeNull();
    expect(state.promotionSummary?.newTitle).toBe(CAREERS_BY_ID.culinary.levels[1].title);
    expect(state.funds).toBeGreaterThan(
      fundsBeforePromo + CAREERS_BY_ID.culinary.levels[0].promotionBonus,
    );
    useGameStore.getState().dismissPromotionSummary();
    expect(useGameStore.getState().promotionSummary).toBeNull();
  });

  it('supports Work From Home checklist completion, PTO, Call In Sick, and Leave Early', () => {
    useGameStore.getState().joinCareer('culinary');
    expect(useGameStore.getState().chooseShiftMode('wfh')).toBe(true);

    let state = useGameStore.getState();
    expect(state.career?.wfhActive).toBe(true);
    expect(state.career?.wfhTasks.length).toBe(2);

    const startFunds = state.funds;
    // Task 1: Cook Basil Pasta on Stove
    expect(useGameStore.getState().enqueueObjectInteraction('obj_stove_1', 'cook_pasta')).toBe(
      true,
    );
    useGameStore.getState().beginPerformingActiveAction();
    useGameStore.getState().tickSimMinutes(38);

    // Task 2: Brew Oat Latte on Espresso Counter
    expect(useGameStore.getState().enqueueObjectInteraction('obj_coffee_1', 'brew_latte')).toBe(
      true,
    );
    useGameStore.getState().beginPerformingActiveAction();
    useGameStore.getState().tickSimMinutes(15);

    state = useGameStore.getState();
    expect(state.career?.wfhPaidToday).toBe(true);
    expect(state.funds).toBe(startFunds - 18 - 5 + 28 * 6);

    // Advance to Day 2 (Tue) and take PTO
    useGameStore.getState().tickSimMinutes(16 * 60);
    expect(useGameStore.getState().clock.day).toBe(2);
    const fundsBeforePto = useGameStore.getState().funds;
    expect(useGameStore.getState().chooseShiftMode('pto')).toBe(true);
    expect(useGameStore.getState().funds).toBe(fundsBeforePto + 28 * 6);

    // Advance to Day 3 (Wed), start shift and leave early without re-commuting
    useGameStore.getState().tickSimMinutes(24 * 60);
    expect(useGameStore.getState().clock.day).toBe(3);
    // Align to 9:30 AM Day 3
    useGameStore.setState({
      clock: { day: 3, hour: 9, minute: 30, totalMinutes: 2 * 1440 + 9 * 60 + 30 },
    });
    expect(useGameStore.getState().goToWorkNow()).toBe(true);
    useGameStore.getState().beginPerformingActiveAction();
    useGameStore.getState().tickSimMinutes(90);
    useGameStore.getState().leaveWorkEarly();
    expect(useGameStore.getState().sim.awayAtWork).toBe(false);
    expect(useGameStore.getState().career?.shiftChoiceForDay).toBe('completed');
    // Ticking more minutes during same shift window must NOT re-commute Maya
    useGameStore.getState().tickSimMinutes(30);
    expect(useGameStore.getState().sim.awayAtWork).toBe(false);
  });

  it('handles Phone Social interactions, Zoomers Delivery, Phone Case customization, and safety-net stipend', () => {
    // Phone case customization
    useGameStore.getState().setPhoneCase('coral_sunset');
    expect(useGameStore.getState().phoneCaseId).toBe('coral_sunset');

    // Social contact interaction increases friendship and adds Social Bunny post
    const initialNora = useGameStore.getState().contacts.find((c) => c.id === 'npc_nora')!;
    const initialFeedLen = useGameStore.getState().socialFeed.length;
    expect(useGameStore.getState().enqueueContactInteraction('npc_nora', 'social_call_chat')).toBe(
      true,
    );
    useGameStore.getState().beginPerformingActiveAction();
    expect(useGameStore.getState().sim.activeProp).toBe('phone');
    useGameStore.getState().tickSimMinutes(22);

    const updatedNora = useGameStore.getState().contacts.find((c) => c.id === 'npc_nora')!;
    expect(updatedNora.relationship).toBe(initialNora.relationship + 11);
    expect(useGameStore.getState().socialFeed.length).toBe(initialFeedLen + 1);

    // Zoomers Delivery deducts cost and restores hunger
    useGameStore.setState((s) => ({
      sim: { ...s.sim, needs: { ...s.sim.needs, hunger: 30 } },
    }));
    const fundsBeforeOrder = useGameStore.getState().funds;
    expect(useGameStore.getState().orderDelivery('zoomers_pizza')).toBe(true);
    useGameStore.getState().beginPerformingActiveAction();
    useGameStore.getState().tickSimMinutes(10);
    expect(useGameStore.getState().funds).toBe(fundsBeforeOrder - 28);
    expect(useGameStore.getState().sim.needs.hunger).toBeGreaterThan(80);

    // Midnight economy check: no automatic §250 stipend when wealthy
    const fundsDay1 = useGameStore.getState().funds;
    useGameStore.getState().tickSimMinutes(16 * 60);
    expect(useGameStore.getState().clock.day).toBe(2);
    expect(useGameStore.getState().funds).toBe(fundsDay1);

    // Safety net: unemployed and broke (< §100) gets +§50 at midnight
    useGameStore.setState({ funds: 40 });
    useGameStore.getState().tickSimMinutes(24 * 60);
    expect(useGameStore.getState().clock.day).toBe(3);
    expect(useGameStore.getState().funds).toBe(90);
  });

  it('gives a 20-min grace window for 9:00 AM hires, stops re-commute when cancelled, and rewards max-rank excellence', () => {
    // Joining Tech Guru (starts 9:00 AM) at 9:00 AM should NOT instantly yank Maya off-lot on tick 1
    useGameStore.getState().joinCareer('tech_guru');
    expect(useGameStore.getState().shiftPrompt).not.toBeNull();
    useGameStore.getState().tickSimMinutes(5);
    expect(useGameStore.getState().sim.awayAtWork).toBe(false);
    expect(useGameStore.getState().actionQueue.length).toBe(0);

    // Explicitly going to work then cancelling commute sets skipped and must NOT re-commute
    expect(useGameStore.getState().goToWorkNow()).toBe(true);
    const commuteId = useGameStore.getState().actionQueue[0].id;
    useGameStore.getState().cancelAction(commuteId);
    expect(useGameStore.getState().career?.shiftChoiceForDay).toBe('skipped');
    useGameStore.getState().tickSimMinutes(30);
    expect(useGameStore.getState().actionQueue.length).toBe(0);
    expect(useGameStore.getState().sim.awayAtWork).toBe(false);

    // Opening PieMenu closes open PhoneDrawer cleanly
    useGameStore.getState().openPhone('career');
    expect(useGameStore.getState().phoneOpen).toBe(true);
    useGameStore.getState().openPieMenu({
      kind: 'floor',
      title: 'Ground',
      screenX: 200,
      screenY: 200,
      worldPos: [0, 0, 0],
      tile: { x: 6, z: 7 },
      options: [{ id: 'walk_here', label: 'Walk Here', icon: 'footprints' }],
    });
    expect(useGameStore.getState().phoneOpen).toBe(false);

    // Max-rank (Level 5) excellence bonus (+§150) & daily task reset after shift
    useGameStore.setState((s) => ({
      career: s.career
        ? {
            ...s.career,
            level: 5,
            performance: 95,
            dailyTaskProgress: 2,
            shiftChoiceForDay: null,
          }
        : null,
      clock: { day: 2, hour: 11, minute: 0, totalMinutes: 1440 + 11 * 60 },
    }));
    expect(useGameStore.getState().goToWorkNow()).toBe(true);
    useGameStore.getState().beginPerformingActiveAction();
    useGameStore.getState().tickSimMinutes(150);
    if (useGameStore.getState().activeChanceCard) {
      useGameStore.getState().resolveChanceCard(0);
      useGameStore.getState().dismissChanceCard();
    }
    const fundsBeforeFinish = useGameStore.getState().funds;
    useGameStore.getState().tickSimMinutes(200);
    const afterMaxShift = useGameStore.getState();
    // Earns shift pay (5h * §105 = §525) + §150 max-rank excellence bonus
    expect(afterMaxShift.funds).toBeGreaterThanOrEqual(fundsBeforeFinish + 525 + 150);
    expect(afterMaxShift.career?.level).toBe(5);
    expect(afterMaxShift.career?.dailyTaskProgress).toBe(0);
    expect(afterMaxShift.career?.performance).toBe(65);
  });
});
