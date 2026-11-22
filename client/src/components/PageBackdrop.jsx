import { useState } from "react";

// Background photo (Bombay Stock Exchange, Mumbai) in client/public/images/.
// If it is missing, the page falls back to the dark gradient.
const BACKDROP_PHOTO = "/images/bull_background.png";

/**
 * Full-screen backdrop shared by the landing page and the lobby.
 *
 * Render it outside any animated container: elements with a transform
 * (entrance animations) would break position: fixed.
 */
export default function PageBackdrop() {
  const [photoMissing, setPhotoMissing] = useState(false);

  return (
    <div className="landing-backdrop" aria-hidden="true">
      {!photoMissing && (
        <img
          src={BACKDROP_PHOTO}
          alt=""
          onError={() => setPhotoMissing(true)}
        />
      )}
    </div>
  );
}
