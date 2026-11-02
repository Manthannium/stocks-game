import { ChevronDown } from "lucide-react";

/**
 * A standard .panel with a clickable header that expands/collapses the body.
 *
 * Controlled component: the parent owns `expanded`.
 */
export default function CollapsiblePanel({
  title,
  expanded,
  onToggle,
  headerRight = null,
  className = "",
  children
}) {
  return (
    <div
      className={`panel collapsible-panel ${
        expanded ? "is-expanded" : "is-collapsed"
      } ${className}`}
    >
      <button
        type="button"
        className="collapsible-header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="panel-label">{title}</span>

        <span className="collapsible-header-right">
          {headerRight}
          <ChevronDown size={16} className="collapsible-chevron" />
        </span>
      </button>

      {expanded && (
        <div className="collapsible-body">{children}</div>
      )}
    </div>
  );
}