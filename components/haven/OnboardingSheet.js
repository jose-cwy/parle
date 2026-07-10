import { ONBOARDING_OPTIONS } from '../../lib/parle/onboarding'

export default function OnboardingSheet({ open, onSelect, onSkip }) {
  return (
    <div
      className={`parle-onboarding${open ? ' parle-onboarding--open' : ''}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="parle-onboarding__backdrop"
        aria-label="Skip onboarding question"
        tabIndex={open ? 0 : -1}
        onClick={onSkip}
      />
      <div
        className="parle-onboarding__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="parle-onboarding-title"
      >
        <p id="parle-onboarding-title" className="parle-onboarding__eyebrow">
          quick question so i can show up better for you
        </p>
        <div className="parle-onboarding__options">
          {ONBOARDING_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="parle-onboarding__option"
              onClick={() => onSelect(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" className="parle-onboarding__skip" onClick={onSkip}>
          skip
        </button>
      </div>
    </div>
  )
}
