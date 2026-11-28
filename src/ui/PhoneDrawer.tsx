import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Droplets,
  Gamepad2,
  Heart,
  Home,
  MapPin,
  Palette,
  Sparkles,
  Truck,
  UserPlus,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { CAREERS, CAREERS_BY_ID } from '../data/careers';
import { SELF_INTERACTIONS } from '../data/catalog';
import {
  MAID_SERVICE_COST,
  MAX_HANDINESS_LEVEL,
  REPAIR_TECH_COST,
  UPGRADE_PARTS_PACK_COST,
  UPGRADE_PARTS_PACK_QTY,
} from '../data/householdData';
import { NEIGHBOR_HOUSES_BY_ID, isTileInRect } from '../data/neighborhood';
import {
  DELIVERY_ITEMS,
  ENTERTAINMENT_APP_IDS,
  PHONE_CASES,
  PHONE_CASES_BY_ID,
  PHONE_SOCIAL_ACTIONS,
} from '../data/phoneData';
import {
  DAY_INITIALS,
  formatShiftHours,
  formatTimeUntilShift,
  getCareerLevel,
  getDayOfWeek,
  getMinutesUntilNextShift,
  getShiftWindowForDay,
  isWorkday,
} from '../engine/careers';
import {
  calculateWeeklyBill,
  getDaysUntilNextMondayBill,
  getHandinessXpForNextLevel,
} from '../engine/household';
import { NEED_LABELS, formatSimTime } from '../engine/simulation';
import {
  RELATIONSHIP_TIER_META,
  ROMANCE_TIER_META,
  getRelationshipTier,
  getRomanceTier,
} from '../engine/social';
import { useGameStore } from '../store/gameStore';
import type { NeedKey, PhoneAppId } from '../types/game';
import { ActionIcon } from './ActionIcon';

const APP_TITLES: Record<PhoneAppId, string> = {
  home: 'Sunnyside OS',
  social: 'Social',
  career: 'Career Hub',
  household: 'Home & Bills',
  order: 'Zoomers Delivery',
  entertainment: 'Entertainment',
};

function formatNeedChips(deltas: Partial<Record<NeedKey, number>>): string[] {
  const chips: string[] = [];
  for (const [key, val] of Object.entries(deltas)) {
    if (val && val > 0) {
      chips.push(`+${val} ${NEED_LABELS[key as NeedKey]}`);
    }
  }
  return chips;
}

export function PhoneDrawer() {
  const mode = useGameStore((s) => s.mode);
  const phoneOpen = useGameStore((s) => s.phoneOpen);
  const phoneApp = useGameStore((s) => s.phoneApp);
  const phoneCaseId = useGameStore((s) => s.phoneCaseId);
  const clock = useGameStore((s) => s.clock);
  const funds = useGameStore((s) => s.funds);
  const sim = useGameStore((s) => s.sim);
  const placedObjects = useGameStore((s) => s.placedObjects);
  const bills = useGameStore((s) => s.bills);
  const handiness = useGameStore((s) => s.handiness);
  const messes = useGameStore((s) => s.messes);
  const contacts = useGameStore((s) => s.contacts);
  const npcs = useGameStore((s) => s.npcs);
  const unlockedHouseIds = useGameStore((s) => s.unlockedHouseIds);
  const socialFeed = useGameStore((s) => s.socialFeed);
  const career = useGameStore((s) => s.career);
  const shiftPrompt = useGameStore((s) => s.shiftPrompt);
  const activeShift = useGameStore((s) => s.activeShift);

  const closePhone = useGameStore((s) => s.closePhone);
  const setPhoneApp = useGameStore((s) => s.setPhoneApp);
  const setPhoneCase = useGameStore((s) => s.setPhoneCase);
  const enqueueContactInteraction = useGameStore((s) => s.enqueueContactInteraction);
  const inviteContactOver = useGameStore((s) => s.inviteContactOver);
  const visitNeighborHouse = useGameStore((s) => s.visitNeighborHouse);
  const orderDelivery = useGameStore((s) => s.orderDelivery);
  const payHouseholdBills = useGameStore((s) => s.payHouseholdBills);
  const callRepairTech = useGameStore((s) => s.callRepairTech);
  const hireCleaningMaid = useGameStore((s) => s.hireCleaningMaid);
  const buyUpgradeParts = useGameStore((s) => s.buyUpgradeParts);
  const enqueueSelfInteraction = useGameStore((s) => s.enqueueSelfInteraction);
  const joinCareer = useGameStore((s) => s.joinCareer);
  const quitCareer = useGameStore((s) => s.quitCareer);
  const chooseShiftMode = useGameStore((s) => s.chooseShiftMode);
  const goToWorkNow = useGameStore((s) => s.goToWorkNow);
  const callInSick = useGameStore((s) => s.callInSick);

  const [casePickerOpen, setCasePickerOpen] = useState(false);
  const [socialTab, setSocialTab] = useState<'contacts' | 'feed'>('contacts');
  const [expandedContactId, setExpandedContactId] = useState<string | null>('npc_nora');
  const [browsingJobs, setBrowsingJobs] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);

  useEffect(() => {
    if (!phoneOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePhone();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phoneOpen, closePhone]);

  if (mode !== 'live' || !phoneOpen) return null;

  const phoneCase = PHONE_CASES_BY_ID[phoneCaseId] ?? PHONE_CASES_BY_ID.coastal_mint;
  const todayDow = getDayOfWeek(clock.day);

  const currentCareerDef = career ? CAREERS_BY_ID[career.careerId] : null;
  const currentLevelDef = career ? getCareerLevel(career.careerId, career.level) : null;
  const skipTodayForNextShift = Boolean(
    career &&
      career.activeDayMarker === clock.day &&
      (career.shiftChoiceForDay === 'pto' ||
        career.shiftChoiceForDay === 'sick' ||
        career.shiftChoiceForDay === 'wfh' ||
        career.shiftChoiceForDay === 'completed'),
  );
  const minsUntilShift = currentLevelDef
    ? getMinutesUntilNextShift(currentLevelDef, clock, skipTodayForNextShift)
    : null;

  const isTodayWorkday = currentLevelDef ? isWorkday(currentLevelDef, clock.day) : false;
  const canGoToWorkNow = (() => {
    if (!career || !currentLevelDef || sim.awayAtWork || activeShift || !isTodayWorkday) {
      return false;
    }
    if (skipTodayForNextShift) return false;
    const { startTotalMinutes, endTotalMinutes } = getShiftWindowForDay(currentLevelDef, clock.day);
    return (
      clock.totalMinutes >= startTotalMinutes - 60 && clock.totalMinutes < endTotalMinutes - 20
    );
  })();

  const canChooseWfhOrOffToday = Boolean(
    career &&
      currentLevelDef &&
      isTodayWorkday &&
      !sim.awayAtWork &&
      !activeShift &&
      !skipTodayForNextShift,
  );

  const entertainmentActions = SELF_INTERACTIONS.filter((inter) =>
    (ENTERTAINMENT_APP_IDS as readonly string[]).includes(inter.id),
  );

  const billForecast = calculateWeeklyBill(placedObjects);
  const daysToNextBill = getDaysUntilNextMondayBill(clock.day, clock.hour, bills.lastBilledDay);
  const brokenHomeCount = placedObjects.filter((o) => !o.houseId && o.isBroken).length;
  const dirtyHomeCount = placedObjects.filter((o) => !o.houseId && (o.cleanliness ?? 100) < 65).length;
  const handinessNextXp = getHandinessXpForNextLevel(handiness.level);
  const handinessPct =
    handiness.level >= MAX_HANDINESS_LEVEL || handinessNextXp <= 0
      ? 100
      : Math.min(100, Math.round((handiness.xp / handinessNextXp) * 100));

  return (
    <aside
      id="sim-phone-drawer"
      className="phone-shell hud-interactive"
      aria-label="Maya's Smartphone"
      style={{
        borderColor: phoneCase.frameColor,
        boxShadow: `0 18px 40px -10px rgba(15, 25, 34, 0.36), 0 0 0 3px ${phoneCase.frameColor}`,
      }}
    >
      {/* Top Phone Bezel / Status Bar */}
      <div className="phone-status-bar" style={{ background: phoneCase.frameColor }}>
        <div className="phone-status-left">
          {phoneApp !== 'home' ? (
            <button
              type="button"
              className="phone-nav-btn"
              onClick={() => {
                setBrowsingJobs(false);
                setConfirmQuit(false);
                setPhoneApp('home');
              }}
              aria-label="Back to Phone Home"
            >
              <ArrowLeft size={14} />
            </button>
          ) : (
            <span className="phone-time-pill">{formatSimTime(clock.hour, clock.minute)}</span>
          )}
          <span className="phone-header-title">{APP_TITLES[phoneApp]}</span>
        </div>

        <div className="phone-status-right">
          <button
            id="btn-phone-case-toggle"
            type="button"
            className={`phone-nav-btn ${casePickerOpen ? 'active' : ''}`}
            onClick={() => setCasePickerOpen((prev) => !prev)}
            title="Customize Phone Case"
            aria-label="Customize Phone Case"
          >
            <Palette size={13} />
          </button>
          <button
            id="btn-phone-close"
            type="button"
            className="phone-nav-btn"
            onClick={closePhone}
            aria-label="Close Smartphone"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Collapsible Sims 4 Phone Case Color Picker */}
      {casePickerOpen && (
        <div className="phone-case-strip">
          <span className="phone-case-strip-label">Case Color</span>
          <div className="phone-case-swatches">
            {PHONE_CASES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`phone-case-swatch ${phoneCaseId === c.id ? 'active' : ''}`}
                style={{ background: c.accentColor }}
                title={c.name}
                aria-label={`Select ${c.name} phone case`}
                onClick={() => setPhoneCase(c.id)}
              >
                {phoneCaseId === c.id && <Check size={10} color="#fff" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Phone Screen Body */}
      <div className="phone-screen-body">
        {/* ======================== HOME SCREEN ======================== */}
        {phoneApp === 'home' && (
          <div className="phone-home-view">
            <div className="phone-app-grid">
              <button
                id="btn-app-social"
                type="button"
                className="phone-app-tile"
                onClick={() => setPhoneApp('social')}
              >
                <span className="phone-app-icon app-social">
                  <Users size={20} />
                </span>
                <span className="phone-app-name">Social</span>
                <span className="phone-app-sub">{contacts.length} Neighbors</span>
              </button>

              <button
                id="btn-app-career"
                type="button"
                className="phone-app-tile"
                onClick={() => {
                  setBrowsingJobs(!career);
                  setConfirmQuit(false);
                  setPhoneApp('career');
                }}
              >
                <span className="phone-app-icon app-career">
                  <Briefcase size={20} />
                  {(shiftPrompt || career?.wfhActive) && <span className="app-tile-dot" />}
                </span>
                <span className="phone-app-name">{career ? 'Manage Job' : 'Find a Job'}</span>
                <span className="phone-app-sub">
                  {currentLevelDef ? currentLevelDef.title : '5 Careers'}
                </span>
              </button>

              <button
                id="btn-app-order"
                type="button"
                className="phone-app-tile"
                onClick={() => setPhoneApp('order')}
              >
                <span className="phone-app-icon app-order">
                  <Truck size={20} />
                </span>
                <span className="phone-app-name">Order</span>
                <span className="phone-app-sub">Zoomers</span>
              </button>

              <button
                id="btn-app-entertainment"
                type="button"
                className="phone-app-tile"
                onClick={() => setPhoneApp('entertainment')}
              >
                <span className="phone-app-icon app-fun">
                  <Gamepad2 size={20} />
                </span>
                <span className="phone-app-name">Fun</span>
                <span className="phone-app-sub">Apps &amp; Music</span>
              </button>
            </div>

            <button
              id="btn-app-household"
              type="button"
              className={`phone-career-widget household-widget ${
                bills.amountDue > 0 || brokenHomeCount > 0 ? 'alert' : ''
              }`}
              onClick={() => setPhoneApp('household')}
            >
              <div className="phone-career-widget-top">
                <span className="phone-widget-kicker" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Home size={11} /> Home &amp; Bills
                </span>
                <span
                  className={`phone-widget-pill ${
                    bills.powerShutoff || bills.waterShutoff
                      ? 'danger'
                      : bills.amountDue > 0 || brokenHomeCount > 0
                        ? 'warn'
                        : ''
                  }`}
                >
                  {bills.waterShutoff
                    ? 'Water Off!'
                    : bills.powerShutoff
                      ? 'Power Off!'
                      : bills.amountDue > 0
                        ? `§${bills.amountDue} Due`
                        : brokenHomeCount > 0
                          ? `${brokenHomeCount} Broken`
                          : 'All Clear'}
                </span>
              </div>
              <div className="phone-widget-main">
                <strong>Handiness Lv {handiness.level}</strong>
                <span>
                  {' '}
                  · {handiness.upgradeParts} Parts · Est. §{billForecast.total}/wk
                </span>
              </div>
            </button>

            <button
              type="button"
              className="phone-career-widget"
              onClick={() => {
                setBrowsingJobs(!career);
                setPhoneApp('career');
              }}
            >
              <div className="phone-career-widget-top">
                <span className="phone-widget-kicker">
                  {currentCareerDef ? currentCareerDef.name : 'Career Status'}
                </span>
                <span className="phone-widget-pill">
                  {activeShift
                    ? 'On Shift'
                    : career?.wfhActive
                      ? 'WFH Active'
                      : minsUntilShift !== null
                        ? formatTimeUntilShift(minsUntilShift)
                        : 'Unemployed'}
                </span>
              </div>
              <div className="phone-widget-main">
                {currentLevelDef ? (
                  <>
                    <strong>{currentLevelDef.title}</strong>
                    <span> · §{currentLevelDef.hourlyPay}/hr</span>
                  </>
                ) : (
                  <span>Tap Career to land your first Sunnyside job!</span>
                )}
              </div>
            </button>
          </div>
        )}

        {/* ======================== SOCIAL APP ======================== */}
        {phoneApp === 'social' && (
          <div className="phone-app-view">
            <div className="phone-segmented">
              <button
                type="button"
                className={`phone-seg-btn ${socialTab === 'contacts' ? 'active' : ''}`}
                onClick={() => setSocialTab('contacts')}
              >
                Neighbors ({contacts.length})
              </button>
              <button
                type="button"
                className={`phone-seg-btn ${socialTab === 'feed' ? 'active' : ''}`}
                onClick={() => setSocialTab('feed')}
              >
                Social Bunny
              </button>
            </div>

            {socialTab === 'contacts' ? (
              <div className="phone-list">
                {contacts.map((contact) => {
                  const tier = getRelationshipTier(contact.relationship);
                  const tierMeta = RELATIONSHIP_TIER_META[tier];
                  const romanceVal = contact.romance ?? 0;
                  const romanceMeta = ROMANCE_TIER_META[getRomanceTier(romanceVal)];
                  const homeHouse = NEIGHBOR_HOUSES_BY_ID[contact.homeHouseId];
                  const npcWorld = npcs.find((n) => n.contactId === contact.id);
                  const isHouseUnlocked = unlockedHouseIds.includes(contact.homeHouseId);
                  const isHeadingToMaya = Boolean(
                    npcWorld &&
                      (npcWorld.knockingAtMayaDoor ||
                        npcWorld.pendingGoal === 'visit_maya_door' ||
                        npcWorld.pendingGoal === 'enter_maya_home'),
                  );
                  const isInsideOwnHome = Boolean(
                    npcWorld &&
                      isTileInRect(
                        { x: npcWorld.tileX, z: npcWorld.tileZ },
                        homeHouse.houseRect,
                      ),
                  );
                  const statusLabel = npcWorld?.visitingMaya
                    ? 'Visiting You'
                    : isHeadingToMaya
                      ? 'Walking Over'
                      : isInsideOwnHome
                        ? 'At Home'
                        : 'Out Strolling';
                  const isOpen = expandedContactId === contact.id;
                  return (
                    <div key={contact.id} className={`contact-card ${isOpen ? 'expanded' : ''}`}>
                      <button
                        type="button"
                        className="contact-header-btn"
                        onClick={() =>
                          setExpandedContactId(isOpen ? null : contact.id)
                        }
                      >
                        <div
                          className="contact-avatar"
                          style={{ background: contact.avatarColor }}
                        >
                          {contact.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div className="contact-info">
                          <div className="contact-name-row">
                            <span className="contact-name">{contact.name}</span>
                            <span
                              className="tier-pill"
                              style={{ background: tierMeta.bgTint, color: tierMeta.color }}
                            >
                              {tierMeta.label}
                            </span>
                          </div>
                          <div className="contact-location-row">
                            <span className="contact-role">{homeHouse.name}</span>
                            <span className="contact-status-dot">· {statusLabel}</span>
                          </div>
                          <div className="rel-bar-track">
                            <div
                              className="rel-bar-fill"
                              style={{
                                width: `${contact.relationship}%`,
                                background: tierMeta.color,
                              }}
                            />
                          </div>
                          {romanceVal > 0 && (
                            <div className="romance-bar-row">
                              <Heart size={10} color={romanceMeta.color} />
                              <div className="rel-bar-track romance-track">
                                <div
                                  className="rel-bar-fill"
                                  style={{
                                    width: `${romanceVal}%`,
                                    background: romanceMeta.color,
                                  }}
                                />
                              </div>
                              <span
                                className="romance-tier-label"
                                style={{ color: romanceMeta.color }}
                              >
                                {romanceMeta.label}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="contact-expand-body">
                          <p className="contact-bio">{contact.bio}</p>
                          <div className="contact-world-actions">
                            <button
                              type="button"
                              className="contact-world-btn invite"
                              disabled={
                                sim.awayAtWork ||
                                Boolean(npcWorld?.visitingMaya) ||
                                isHeadingToMaya
                              }
                              onClick={() => inviteContactOver(contact.id)}
                            >
                              <UserPlus size={12} />
                              <span>
                                {npcWorld?.visitingMaya
                                  ? 'Here Now'
                                  : isHeadingToMaya
                                    ? 'On the Way'
                                    : 'Invite Over'}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="contact-world-btn visit"
                              disabled={sim.awayAtWork}
                              onClick={() => visitNeighborHouse(contact.homeHouseId)}
                            >
                              <MapPin size={12} />
                              <span>{isHouseUnlocked ? 'Go Inside' : 'Visit House'}</span>
                            </button>
                          </div>
                          <div className="contact-actions-grid">
                            {PHONE_SOCIAL_ACTIONS.map((act) => (
                              <button
                                key={act.id}
                                type="button"
                                className="contact-action-btn"
                                disabled={sim.awayAtWork}
                                onClick={() => enqueueContactInteraction(contact.id, act.id)}
                              >
                                <ActionIcon name={act.icon} size={12} />
                                <span>{act.label}</span>
                                <span className="contact-action-gain">+{act.relationshipDelta}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="phone-list">
                {socialFeed.map((post) => (
                  <article key={post.id} className="feed-card">
                    <div className="feed-card-head">
                      <span
                        className="feed-author-dot"
                        style={{ background: post.authorColor }}
                      />
                      <span className="feed-author-name">{post.authorName}</span>
                      <span className="feed-timestamp">
                        D{post.day} · {formatSimTime(post.hour, post.minute)}
                      </span>
                    </div>
                    <p className="feed-text">{post.text}</p>
                    <div className="feed-footer">
                      <span className={`feed-tag tag-${post.tag}`}>{post.tag}</span>
                      <span className="feed-likes">
                        <Heart size={11} /> {post.likes}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================== CAREER APP ======================== */}
        {phoneApp === 'career' && (
          <div className="phone-app-view">
            {career && currentCareerDef && currentLevelDef && !browsingJobs ? (
              <div className="career-manage-view">
                <div className="career-hero-card">
                  <div className="career-hero-top">
                    <span
                      className="career-badge-icon"
                      style={{ background: currentCareerDef.accentColor }}
                    >
                      <ActionIcon name={currentCareerDef.icon} size={15} />
                    </span>
                    <div className="career-hero-titles">
                      <div className="career-title-row">
                        <strong>{currentLevelDef.title}</strong>
                        <span className="career-lv-chip">
                          {career.level >= currentCareerDef.levels.length
                            ? `Lv ${career.level} · Max`
                            : `Lv ${career.level}/${currentCareerDef.levels.length}`}
                        </span>
                      </div>
                      <span className="career-sub-meta">
                        {currentCareerDef.name} · §{currentLevelDef.hourlyPay}/hr ·{' '}
                        {formatShiftHours(
                          currentLevelDef.shiftStartHour,
                          currentLevelDef.shiftDurationHours,
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Weekly Schedule Pills */}
                  <div className="schedule-row">
                    <div className="schedule-days">
                      {DAY_INITIALS.map((letter, idx) => {
                        const works = currentLevelDef.workDays.includes(idx);
                        const isToday = idx === todayDow;
                        return (
                          <span
                            key={idx}
                            className={`sched-day ${works ? 'workday' : ''} ${
                              isToday ? 'today' : ''
                            }`}
                          >
                            {letter}
                          </span>
                        );
                      })}
                    </div>
                    <span className="next-shift-chip">
                      <Clock size={11} />
                      {activeShift
                        ? 'At Work'
                        : career.wfhActive
                          ? career.wfhPaidToday
                            ? 'WFH Done'
                            : 'WFH Today'
                          : minsUntilShift !== null
                            ? formatTimeUntilShift(minsUntilShift)
                            : 'Off'}
                    </span>
                  </div>

                  {/* Performance Meter */}
                  <div className="perf-block">
                    <div className="perf-head">
                      <span>Job Performance</span>
                      <strong>{Math.round(career.performance)}%</strong>
                    </div>
                    <div className="perf-track">
                      <div
                        className="perf-fill"
                        style={{
                          width: `${Math.round(career.performance)}%`,
                          background: currentCareerDef.accentColor,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Daily Prep Task Card */}
                <div className="career-task-card">
                  <div className="career-task-head">
                    <span className="career-task-kicker">Daily Prep Task</span>
                    <span
                      className={`career-task-status ${
                        career.dailyTaskProgress >= currentLevelDef.dailyTask.targetCount
                          ? 'done'
                          : ''
                      }`}
                    >
                      {career.dailyTaskProgress >= currentLevelDef.dailyTask.targetCount ? (
                        <>
                          <CheckCircle2 size={12} /> Complete
                        </>
                      ) : (
                        `${career.dailyTaskProgress}/${currentLevelDef.dailyTask.targetCount}`
                      )}
                    </span>
                  </div>
                  <div className="career-task-label">{currentLevelDef.dailyTask.label}</div>
                  <div className="career-task-hint">{currentLevelDef.dailyTask.hint}</div>
                </div>

                {/* Active Work From Home Checklist */}
                {career.wfhActive && career.wfhTasks.length > 0 && (
                  <div className="career-task-card wfh-card">
                    <div className="career-task-head">
                      <span className="career-task-kicker">Work From Home</span>
                      <span className={`career-task-status ${career.wfhPaidToday ? 'done' : ''}`}>
                        {career.wfhPaidToday
                          ? 'Paid!'
                          : `+§${currentLevelDef.hourlyPay * currentLevelDef.shiftDurationHours}`}
                      </span>
                    </div>
                    <div className="wfh-task-list">
                      {career.wfhTasks.map((task) => {
                        const done = task.progress >= task.targetCount;
                        return (
                          <div key={task.ruleId} className={`wfh-row ${done ? 'done' : ''}`}>
                            <CheckCircle2 size={13} />
                            <div>
                              <div className="wfh-row-title">{task.label}</div>
                              <div className="wfh-row-hint">{task.hint}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Career Action Buttons */}
                <div className="career-actions-grid">
                  {canGoToWorkNow && (
                    <button
                      id="btn-career-go-work"
                      type="button"
                      className="phone-primary-btn"
                      onClick={goToWorkNow}
                    >
                      Go to Work Now
                    </button>
                  )}

                  {canChooseWfhOrOffToday && (
                    <button
                      id="btn-career-wfh"
                      type="button"
                      className="phone-soft-btn"
                      onClick={() => chooseShiftMode('wfh')}
                    >
                      Work From Home
                    </button>
                  )}

                  <button
                    id="btn-career-pto"
                    type="button"
                    className="phone-soft-btn"
                    disabled={!canChooseWfhOrOffToday || Math.floor(career.ptoDays) < 1}
                    onClick={() => chooseShiftMode('pto')}
                  >
                    Take PTO ({Math.floor(career.ptoDays)})
                  </button>

                  <button
                    id="btn-career-sick"
                    type="button"
                    className="phone-soft-btn"
                    disabled={!canChooseWfhOrOffToday}
                    onClick={callInSick}
                  >
                    Call In Sick
                  </button>

                  <button
                    type="button"
                    className="phone-soft-btn"
                    onClick={() => {
                      setConfirmQuit(false);
                      setBrowsingJobs(true);
                    }}
                  >
                    Switch Career
                  </button>

                  {!confirmQuit ? (
                    <button
                      id="btn-career-quit"
                      type="button"
                      className="phone-danger-btn"
                      onClick={() => setConfirmQuit(true)}
                    >
                      Quit Job
                    </button>
                  ) : (
                    <button
                      id="btn-career-quit-confirm"
                      type="button"
                      className="phone-danger-btn solid"
                      onClick={() => {
                        setConfirmQuit(false);
                        quitCareer();
                      }}
                    >
                      Confirm Quit
                    </button>
                  )}
                </div>

                <div className="career-stats-footer">
                  <span>Shifts: {career.shiftsCompleted}</span>
                  <span>Earned: §{career.totalEarned.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="phone-list">
                {career && (
                  <button
                    type="button"
                    className="phone-back-inline"
                    onClick={() => setBrowsingJobs(false)}
                  >
                    <ArrowLeft size={12} /> Back to Current Job
                  </button>
                )}
                {CAREERS.map((job) => {
                  const lv1 = job.levels[0];
                  const isCurrent = career?.careerId === job.id;
                  return (
                    <div key={job.id} className={`job-listing-card ${isCurrent ? 'current' : ''}`}>
                      <div className="job-listing-head">
                        <span
                          className="career-badge-icon"
                          style={{ background: job.accentColor }}
                        >
                          <ActionIcon name={job.icon} size={14} />
                        </span>
                        <div className="job-listing-titles">
                          <div className="job-listing-name-row">
                            <strong>{job.name}</strong>
                            <span className="job-cat-pill">{job.category}</span>
                          </div>
                          <span className="job-listing-pay">
                            {lv1.title} · §{lv1.hourlyPay}/hr (up to §
                            {job.levels[job.levels.length - 1].hourlyPay}/hr)
                          </span>
                        </div>
                      </div>
                      <p className="job-listing-desc">{job.tagline}</p>
                      <div className="job-listing-bottom">
                        <div className="schedule-days compact">
                          {DAY_INITIALS.map((letter, idx) => (
                            <span
                              key={idx}
                              className={`sched-day ${lv1.workDays.includes(idx) ? 'workday' : ''}`}
                            >
                              {letter}
                            </span>
                          ))}
                        </div>
                        <button
                          id={`btn-join-${job.id}`}
                          type="button"
                          className={isCurrent ? 'phone-soft-btn sm' : 'phone-primary-btn sm'}
                          disabled={isCurrent}
                          onClick={() => {
                            joinCareer(job.id);
                            setBrowsingJobs(false);
                          }}
                        >
                          {isCurrent ? 'Active' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================== HOME & BILLS APP ======================== */}
        {phoneApp === 'household' && (
          <div className="phone-app-view">
            {/* Weekly Bills & Utilities Card */}
            <div className="career-hero-card">
              <div className="household-card-head">
                <div>
                  <div className="career-task-kicker">Weekly Utility Bill</div>
                  <strong className="household-bill-amount">
                    {bills.amountDue > 0 ? `§${bills.amountDue} Due` : 'Paid in Full'}
                  </strong>
                </div>
                <span
                  className={`phone-widget-pill ${
                    bills.powerShutoff || bills.waterShutoff
                      ? 'danger'
                      : bills.amountDue > 0
                        ? 'warn'
                        : ''
                  }`}
                >
                  {bills.amountDue > 0
                    ? bills.waterShutoff
                      ? 'Utilities Off'
                      : bills.powerShutoff
                        ? 'Power Off'
                        : 'Due Now'
                    : daysToNextBill === 0
                      ? 'Mon 8 AM'
                      : `In ${daysToNextBill}d (Mon)`}
                </span>
              </div>

              <div className="utility-status-row">
                <span className={`utility-chip ${bills.powerShutoff ? 'off' : 'on'}`}>
                  <Zap size={11} /> Power: {bills.powerShutoff ? 'OFF' : 'On'}
                </span>
                <span className={`utility-chip ${bills.waterShutoff ? 'off' : 'on'}`}>
                  <Droplets size={11} /> Water: {bills.waterShutoff ? 'OFF' : 'On'}
                </span>
              </div>

              <div className="bill-breakdown-box">
                <div className="bill-row">
                  <span>Lot Property Tax</span>
                  <span>§{billForecast.lotBase}</span>
                </div>
                <div className="bill-row">
                  <span>Home Furnishings</span>
                  <span>§{billForecast.furnishings}</span>
                </div>
                {billForecast.ecoDiscount > 0 && (
                  <div className="bill-row eco">
                    <span>Eco Upgrades ({billForecast.ecoUpgradeCount})</span>
                    <span>-§{billForecast.ecoDiscount}</span>
                  </div>
                )}
                <div className="bill-row total">
                  <span>{bills.amountDue > 0 ? 'Amount Due' : 'Est. Next Monday'}</span>
                  <strong>§{bills.amountDue > 0 ? bills.amountDue : billForecast.total}</strong>
                </div>
              </div>

              {bills.amountDue > 0 && (
                <button
                  id="btn-pay-bills-phone"
                  type="button"
                  className="phone-primary-btn"
                  disabled={funds < bills.amountDue}
                  onClick={payHouseholdBills}
                >
                  Pay Household Bills (§{bills.amountDue})
                </button>
              )}
            </div>

            {/* Handiness & Upgrade Parts Card */}
            <div className="career-task-card">
              <div className="career-task-head">
                <span className="career-task-kicker">
                  <Wrench size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> Handiness
                  Skill
                </span>
                <span className="career-lv-chip">
                  {handiness.level >= MAX_HANDINESS_LEVEL
                    ? `Lv ${handiness.level} · Master`
                    : `Lv ${handiness.level}/${MAX_HANDINESS_LEVEL}`}
                </span>
              </div>
              <div className="perf-block">
                <div className="perf-head">
                  <span>
                    {handiness.level >= MAX_HANDINESS_LEVEL
                      ? 'All upgrades unlocked + faster repairs!'
                      : `${handiness.xp}/${handinessNextXp} XP to Lv ${handiness.level + 1}`}
                  </span>
                  <span>{handiness.upgradeParts} Parts</span>
                </div>
                <div className="perf-track">
                  <div
                    className="perf-fill"
                    style={{ width: `${handinessPct}%`, background: '#3b89b8' }}
                  />
                </div>
              </div>
              <button
                id="btn-buy-upgrade-parts"
                type="button"
                className="phone-soft-btn sm"
                disabled={funds < UPGRADE_PARTS_PACK_COST}
                onClick={buyUpgradeParts}
                style={{ marginTop: 4 }}
              >
                Buy +{UPGRADE_PARTS_PACK_QTY} Upgrade Parts (§{UPGRADE_PARTS_PACK_COST})
              </button>
            </div>

            {/* Home Care Status & Repair / Maid Dispatch */}
            <div className="career-task-card">
              <div className="career-task-head">
                <span className="career-task-kicker">Home Care &amp; Services</span>
                <span className="career-task-status">
                  {brokenHomeCount === 0 && dirtyHomeCount === 0 && messes.length === 0
                    ? 'Spotless'
                    : 'Needs Care'}
                </span>
              </div>
              <div className="home-care-stats">
                <span className={`care-pill ${brokenHomeCount > 0 ? 'warn' : ''}`}>
                  Broken: {brokenHomeCount}
                </span>
                <span className={`care-pill ${dirtyHomeCount > 0 ? 'warn' : ''}`}>
                  Grimy: {dirtyHomeCount}
                </span>
                <span className={`care-pill ${messes.length > 0 ? 'warn' : ''}`}>
                  Messes: {messes.length}
                </span>
              </div>
              <div className="career-actions-grid" style={{ marginTop: 6 }}>
                <button
                  id="btn-call-repair-tech"
                  type="button"
                  className="phone-primary-btn sm"
                  disabled={brokenHomeCount === 0 || funds < REPAIR_TECH_COST}
                  onClick={callRepairTech}
                >
                  Repair Tech (§{REPAIR_TECH_COST})
                </button>
                <button
                  id="btn-hire-maid"
                  type="button"
                  className="phone-soft-btn sm"
                  disabled={
                    (dirtyHomeCount === 0 && messes.length === 0) || funds < MAID_SERVICE_COST
                  }
                  onClick={hireCleaningMaid}
                >
                  Hire Maid (§{MAID_SERVICE_COST})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================== ZOOMERS ORDER APP ======================== */}
        {phoneApp === 'order' && (
          <div className="phone-app-view">
            <div className="phone-funds-banner">
              <span>Available Balance</span>
              <strong>§{funds.toLocaleString()}</strong>
            </div>
            <div className="phone-list">
              {/* Instant Home Services */}
              <div className="order-card">
                <div className="order-card-head">
                  <span className="order-icon-wrap cat-service">
                    <Wrench size={14} />
                  </span>
                  <div className="order-meta">
                    <div className="order-name-row">
                      <strong>Repair Tech Dispatch</strong>
                      <span className="order-price-pill">§{REPAIR_TECH_COST}</span>
                    </div>
                    <p className="order-desc">
                      Fixes all broken home appliances &amp; mops leaking puddles right away.
                    </p>
                  </div>
                </div>
                <div className="order-bottom">
                  <span className="need-chip">
                    {brokenHomeCount > 0 ? `${brokenHomeCount} broken` : 'None broken'}
                  </span>
                  <button
                    type="button"
                    className="phone-primary-btn sm"
                    disabled={brokenHomeCount === 0 || funds < REPAIR_TECH_COST}
                    onClick={callRepairTech}
                  >
                    Dispatch
                  </button>
                </div>
              </div>

              <div className="order-card">
                <div className="order-card-head">
                  <span className="order-icon-wrap cat-service">
                    <Sparkles size={14} />
                  </span>
                  <div className="order-meta">
                    <div className="order-name-row">
                      <strong>Cleaning Maid Visit</strong>
                      <span className="order-price-pill">§{MAID_SERVICE_COST}</span>
                    </div>
                    <p className="order-desc">
                      Scrubs all grimy fixtures &amp; clears every puddle, dish, and trash pile.
                    </p>
                  </div>
                </div>
                <div className="order-bottom">
                  <span className="need-chip">
                    {dirtyHomeCount + messes.length > 0
                      ? `${dirtyHomeCount + messes.length} spots`
                      : 'Spotless'}
                  </span>
                  <button
                    type="button"
                    className="phone-primary-btn sm"
                    disabled={
                      (dirtyHomeCount === 0 && messes.length === 0) || funds < MAID_SERVICE_COST
                    }
                    onClick={hireCleaningMaid}
                  >
                    Book
                  </button>
                </div>
              </div>

              {DELIVERY_ITEMS.map((item) => {
                const canAfford = funds >= item.cost && !sim.awayAtWork;
                const chips = formatNeedChips(item.needDeltas);
                return (
                  <div key={item.id} className="order-card">
                    <div className="order-card-head">
                      <span className={`order-icon-wrap cat-${item.category}`}>
                        <ActionIcon name={item.icon} size={14} />
                      </span>
                      <div className="order-meta">
                        <div className="order-name-row">
                          <strong>{item.name}</strong>
                          <span className="order-price-pill">§{item.cost}</span>
                        </div>
                        <p className="order-desc">{item.description}</p>
                      </div>
                    </div>
                    <div className="order-bottom">
                      <div className="need-chip-row">
                        {chips.map((c) => (
                          <span key={c} className="need-chip">
                            {c}
                          </span>
                        ))}
                      </div>
                      <button
                        id={`btn-order-${item.id}`}
                        type="button"
                        className="phone-primary-btn sm"
                        disabled={!canAfford}
                        onClick={() => orderDelivery(item.id)}
                      >
                        Order
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================== ENTERTAINMENT APP ======================== */}
        {phoneApp === 'entertainment' && (
          <div className="phone-app-view">
            <div className="phone-list">
              {entertainmentActions.map((act) => {
                const chips = formatNeedChips(act.needDeltas);
                return (
                  <button
                    key={act.id}
                    id={`btn-ent-${act.id}`}
                    type="button"
                    className="ent-card"
                    disabled={sim.awayAtWork}
                    onClick={() => {
                      if (enqueueSelfInteraction(act.id)) {
                        closePhone();
                      }
                    }}
                  >
                    <span className="ent-icon-badge">
                      <ActionIcon name={act.icon} size={16} />
                    </span>
                    <div className="ent-meta">
                      <div className="ent-name-row">
                        <strong>{act.label}</strong>
                        <span className="ent-time">{act.durationSimMinutes}m</span>
                      </div>
                      <div className="need-chip-row">
                        {chips.map((c) => (
                          <span key={c} className="need-chip">
                            {c}
                          </span>
                        ))}
                        {act.emotionBoost && (
                          <span className="need-chip mood">
                            <Sparkles size={10} /> {act.emotionBoost}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Home Indicator Pill */}
      <div className="phone-home-bar">
        <button
          type="button"
          className="phone-home-pill-btn"
          onClick={() => {
            setBrowsingJobs(false);
            setPhoneApp('home');
          }}
          aria-label="Phone Home"
        >
          <Home size={12} />
        </button>
      </div>
    </aside>
  );
}
