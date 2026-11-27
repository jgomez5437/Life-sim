import { useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Gamepad2,
  Heart,
  Home,
  Palette,
  Sparkles,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { CAREERS, CAREERS_BY_ID } from '../data/careers';
import { SELF_INTERACTIONS } from '../data/catalog';
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
import { NEED_LABELS, formatSimTime } from '../engine/simulation';
import { RELATIONSHIP_TIER_META, getRelationshipTier } from '../engine/social';
import { useGameStore } from '../store/gameStore';
import type { NeedKey, PhoneAppId } from '../types/game';
import { ActionIcon } from './ActionIcon';

const APP_TITLES: Record<PhoneAppId, string> = {
  home: 'Sunnyside OS',
  social: 'Social',
  career: 'Career Hub',
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
  const contacts = useGameStore((s) => s.contacts);
  const socialFeed = useGameStore((s) => s.socialFeed);
  const career = useGameStore((s) => s.career);
  const shiftPrompt = useGameStore((s) => s.shiftPrompt);
  const activeShift = useGameStore((s) => s.activeShift);

  const closePhone = useGameStore((s) => s.closePhone);
  const setPhoneApp = useGameStore((s) => s.setPhoneApp);
  const setPhoneCase = useGameStore((s) => s.setPhoneCase);
  const enqueueContactInteraction = useGameStore((s) => s.enqueueContactInteraction);
  const orderDelivery = useGameStore((s) => s.orderDelivery);
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
                <span className="phone-app-sub">{contacts.length} Friends</span>
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
                Contacts ({contacts.length})
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
                          <span className="contact-role">{contact.role}</span>
                          <div className="rel-bar-track">
                            <div
                              className="rel-bar-fill"
                              style={{
                                width: `${contact.relationship}%`,
                                background: tierMeta.color,
                              }}
                            />
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="contact-expand-body">
                          <p className="contact-bio">{contact.bio}</p>
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
                          Lv {career.level}/{currentCareerDef.levels.length}
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

        {/* ======================== ZOOMERS ORDER APP ======================== */}
        {phoneApp === 'order' && (
          <div className="phone-app-view">
            <div className="phone-funds-banner">
              <span>Available Balance</span>
              <strong>§{funds.toLocaleString()}</strong>
            </div>
            <div className="phone-list">
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
