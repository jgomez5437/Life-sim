import { Award, Briefcase, Clock, LogOut, Sparkles, X } from 'lucide-react';
import { CAREERS_BY_ID } from '../data/careers';
import {
  WORK_TONES,
  WORK_TONE_LIST,
  formatHour12,
  formatTimeUntilShift,
  getCareerLevel,
} from '../engine/careers';
import { useGameStore } from '../store/gameStore';

export function WorkShiftHUD() {
  const mode = useGameStore((s) => s.mode);
  const clock = useGameStore((s) => s.clock);
  const career = useGameStore((s) => s.career);
  const shiftPrompt = useGameStore((s) => s.shiftPrompt);
  const activeShift = useGameStore((s) => s.activeShift);
  const activeChanceCard = useGameStore((s) => s.activeChanceCard);
  const promotionSummary = useGameStore((s) => s.promotionSummary);

  const chooseShiftMode = useGameStore((s) => s.chooseShiftMode);
  const dismissShiftPrompt = useGameStore((s) => s.dismissShiftPrompt);
  const setWorkTone = useGameStore((s) => s.setWorkTone);
  const leaveWorkEarly = useGameStore((s) => s.leaveWorkEarly);
  const resolveChanceCard = useGameStore((s) => s.resolveChanceCard);
  const dismissChanceCard = useGameStore((s) => s.dismissChanceCard);
  const dismissPromotionSummary = useGameStore((s) => s.dismissPromotionSummary);

  if (mode !== 'live') return null;

  const shiftCareerDef = activeShift ? CAREERS_BY_ID[activeShift.careerId] : null;
  const shiftLevelDef = activeShift
    ? getCareerLevel(activeShift.careerId, activeShift.level)
    : null;
  const promptCareerDef = shiftPrompt ? CAREERS_BY_ID[shiftPrompt.careerId] : null;
  const promptLevelDef = shiftPrompt
    ? getCareerLevel(shiftPrompt.careerId, shiftPrompt.level)
    : null;

  const shiftDuration = activeShift
    ? Math.max(1, activeShift.endTotalMinutes - activeShift.startTotalMinutes)
    : 1;
  const shiftProgress = activeShift
    ? Math.max(
        0,
        Math.min(1, (clock.totalMinutes - activeShift.startTotalMinutes) / shiftDuration),
      )
    : 0;
  const shiftMinutesLeft = activeShift
    ? Math.max(0, Math.ceil(activeShift.endTotalMinutes - clock.totalMinutes))
    : 0;

  return (
    <>
      {/* 1. Pre-Shift Decision Banner (Sims 4 City Living / Freelancer choice) */}
      {shiftPrompt && !activeShift && promptCareerDef && promptLevelDef && (
        <div
          id="shift-prompt-banner"
          className="shift-prompt-banner glass-pill hud-interactive"
          role="dialog"
          aria-label="Upcoming Work Shift"
        >
          <div className="shift-prompt-top">
            <span
              className="shift-prompt-badge"
              style={{ background: promptCareerDef.accentColor }}
            >
              <Briefcase size={13} color="#fff" />
            </span>
            <div className="shift-prompt-text">
              <strong>
                {promptLevelDef.title} Shift at {formatHour12(shiftPrompt.shiftStartHour)}
              </strong>
              <span>
                {promptCareerDef.name} · §{promptLevelDef.hourlyPay}/hr ({shiftPrompt.shiftDurationHours}h)
              </span>
            </div>
            <button
              type="button"
              className="shift-dismiss-btn"
              onClick={dismissShiftPrompt}
              aria-label="Dismiss shift reminder"
            >
              <X size={14} />
            </button>
          </div>
          <div className="shift-prompt-actions">
            <button
              id="btn-prompt-go-work"
              type="button"
              className="phone-primary-btn sm"
              onClick={() => chooseShiftMode('rabbit_hole')}
            >
              Go to Work
            </button>
            <button
              id="btn-prompt-wfh"
              type="button"
              className="phone-soft-btn sm"
              onClick={() => chooseShiftMode('wfh')}
            >
              Work From Home
            </button>
            <button
              id="btn-prompt-pto"
              type="button"
              className="phone-soft-btn sm"
              disabled={!career || Math.floor(career.ptoDays) < 1}
              onClick={() => chooseShiftMode('pto')}
            >
              Take PTO ({career ? Math.floor(career.ptoDays) : 0})
            </button>
          </div>
        </div>
      )}

      {/* 2. Active Rabbit-Hole Work Shift Card with Work Tones */}
      {activeShift && shiftCareerDef && shiftLevelDef && (
        <section
          id="active-work-shift-card"
          className="work-shift-card glass-pill hud-interactive"
          aria-label="Active Work Shift Controls"
        >
          <div className="work-shift-head">
            <div className="work-shift-title-wrap">
              <span
                className="shift-prompt-badge"
                style={{ background: shiftCareerDef.accentColor }}
              >
                <Briefcase size={13} color="#fff" />
              </span>
              <div>
                <div className="work-shift-title">{shiftLevelDef.title}</div>
                <div className="work-shift-sub">
                  <Clock size={10} /> {formatTimeUntilShift(shiftMinutesLeft)} left · §
                  {shiftLevelDef.hourlyPay}/hr
                </div>
              </div>
            </div>
            <button
              id="btn-leave-work-early"
              type="button"
              className="leave-early-btn"
              onClick={leaveWorkEarly}
              title="Leave shift early (prorated pay)"
            >
              <LogOut size={12} />
              <span>Leave</span>
            </button>
          </div>

          <div className="shift-progress-track">
            <div
              className="shift-progress-fill"
              style={{
                width: `${Math.round(shiftProgress * 100)}%`,
                background: shiftCareerDef.accentColor,
              }}
            />
          </div>

          <div className="work-tone-grid" role="group" aria-label="Work Tone">
            {WORK_TONE_LIST.map((tone) => (
              <button
                key={tone.id}
                id={`btn-tone-${tone.id}`}
                type="button"
                className={`work-tone-btn ${activeShift.tone === tone.id ? 'active' : ''}`}
                onClick={() => setWorkTone(tone.id)}
              >
                {tone.shortLabel}
              </button>
            ))}
          </div>
          <div className="work-tone-caption">{WORK_TONES[activeShift.tone].description}</div>
        </section>
      )}

      {/* 3. Mid-Shift Chance Card Dilemma Modal */}
      {activeChanceCard && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Work Dilemma">
          <div className="modal-card chance-modal-card">
            <div className="chance-eyebrow">
              <Briefcase size={12} /> {activeChanceCard.careerName} Dilemma
            </div>
            <h2 className="modal-title">{activeChanceCard.card.title}</h2>
            <p className="chance-scenario">{activeChanceCard.card.scenario}</p>

            {activeChanceCard.resolvedOptionIndex === undefined ? (
              <div className="chance-options">
                {activeChanceCard.card.options.map((opt, idx) => (
                  <button
                    key={opt.label}
                    id={`btn-chance-opt-${idx}`}
                    type="button"
                    className="chance-option-btn"
                    onClick={() => resolveChanceCard(idx as 0 | 1)}
                  >
                    <strong>{opt.label}</strong>
                    <span>{opt.sublabel}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="chance-outcome-box">
                <p>
                  {activeChanceCard.card.options[activeChanceCard.resolvedOptionIndex].outcomeText}
                </p>
                <button
                  id="btn-chance-continue"
                  type="button"
                  className="btn-primary"
                  onClick={dismissChanceCard}
                >
                  Back to Shift
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Promotion Celebration Modal */}
      {promotionSummary && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Career Promotion"
        >
          <div className="modal-card promo-modal-card">
            <div className="promo-medal">
              <Award size={28} />
            </div>
            <div className="chance-eyebrow centered">
              <Sparkles size={12} /> Promotion Unlocked!
            </div>
            <h2 className="modal-title centered">{promotionSummary.newTitle}</h2>
            <p className="promo-sub">
              {promotionSummary.careerName} · Level {promotionSummary.newLevel}
            </p>

            <div className="promo-stats">
              <div className="promo-stat-row">
                <span>Hourly Raise</span>
                <strong>
                  §{promotionSummary.oldHourlyPay}/hr → §{promotionSummary.newHourlyPay}/hr
                </strong>
              </div>
              <div className="promo-stat-row">
                <span>Promotion Bonus</span>
                <strong className="promo-bonus">+§{promotionSummary.bonus}</strong>
              </div>
              <div className="promo-stat-row">
                <span>New Daily Task</span>
                <strong>{promotionSummary.dailyTaskLabel}</strong>
              </div>
            </div>

            <button
              id="btn-promo-dismiss"
              type="button"
              className="btn-primary promo-ok-btn"
              onClick={dismissPromotionSummary}
            >
              Awesome!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
