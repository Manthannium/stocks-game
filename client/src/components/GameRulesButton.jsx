import { useCallback, useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";

import GameRulesModal from "./GameRulesModal";

/**
 * Opens the game rules modal.
 *
 * variant="default"   compact secondary button ("Game rules")
 * variant="highlight" prominent call-out for new players (landing page)
 */
export default function GameRulesButton({ className = "", variant = "default" }) {
  const [open, setOpen] = useState(false);

  // Stable reference so the modal's effect doesn't re-run on every render.
  const close = useCallback(() => setOpen(false), []);

  const isHighlight = variant === "highlight";

  return (
    <>
      <button
        type="button"
        className={`${isHighlight ? "rules-button-highlight" : "secondary-button rules-button"} ${className}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {isHighlight ? (
          <>
            <span className="rules-highlight-icon">
              <BookOpen size={17} />
            </span>

            <span className="rules-highlight-text">
              <b>New here? Read the game rules</b>
              <small>A 2-minute guide to trading and winning</small>
            </span>

            <ArrowRight size={16} className="rules-highlight-arrow" />
          </>
        ) : (
          <>
            <BookOpen size={15} />
            Game rules
          </>
        )}
      </button>

      <GameRulesModal open={open} onClose={close} />
    </>
  );
}
