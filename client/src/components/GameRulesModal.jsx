import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BookOpen, X } from "lucide-react";

import { GAME_RULES } from "../content/gameRules";

/**
 * Read-only rules dialog.
 * Closes on Esc, backdrop click, the X button, or "Got it".
 *
 * Rendered into document.body through a portal so it looks the same on
 * every page: page containers use transforms (entrance animations) and
 * descendant styles (e.g. centered text in the lobby) that would
 * otherwise change its position and typography.
 */
export default function GameRulesModal({ open, onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    // Lock page scroll and move focus into the dialog.
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="rules-overlay"
      role="presentation"
      onMouseDown={(event) => {
        // Only a click on the backdrop itself closes the dialog.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="rules-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
      >
        <header className="rules-header">
          <span className="rules-header-icon">
            <BookOpen size={18} />
          </span>

          <div className="rules-header-text">
            <span className="rules-kicker">How to play</span>
            <h2 id="rules-title">Game rules</h2>
          </div>

          <button
            ref={closeButtonRef}
            className="rules-close"
            onClick={onClose}
            aria-label="Close game rules"
          >
            <X size={16} />
          </button>
        </header>

        <div className="rules-body">
          <p className="rules-intro">{GAME_RULES.intro}</p>

          {GAME_RULES.sections.map((section) => (
            <section className="rules-section" key={section.title}>
              <h3>{section.title}</h3>

              {section.items && (
                <ul className="rules-list">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}

              {section.terms && (
                <dl className="rules-terms">
                  {section.terms.map(({ term, text }) => (
                    <div className="rules-term" key={term}>
                      <dt>{term}</dt>
                      <dd>{text}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {section.formula && (
                <p className="rules-formula">{section.formula}</p>
              )}
            </section>
          ))}
        </div>

        <footer className="rules-footer">
          <p>{GAME_RULES.footer}</p>

          <button className="primary-button" onClick={onClose}>
            Got it
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
