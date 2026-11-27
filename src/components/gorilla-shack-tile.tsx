import { ArrowUpRight, Trees } from 'lucide-react';

const WILDGROVE_URL = 'https://wildgrove.missingpiecepuzzles.fun/';

/**
 * Centralised horizontal partner strip placed below the Solo and Interactive Games sections,
 * pairing The Gorilla Shack tile (https://thegorillashack.co.uk/) with the Wildgrove pill
 * (https://wildgrove.missingpiecepuzzles.fun/).
 */
export function GorillaShackTile() {
  return (
    <div className="gorilla-shack-tile-wrapper">
      <a
        href="https://thegorillashack.co.uk/"
        target="_blank"
        rel="noopener noreferrer"
        className="gorilla-shack-tile"
        aria-label="Visit The Gorilla Shack — For more fun and games"
      >
        <img
          src="/gorilla-shack-logo.jpg"
          alt="The Gorilla Shack"
          className="gorilla-shack-tile__logo"
        />
        <div className="gorilla-shack-tile__body">
          <span className="gorilla-shack-tile__eyebrow">
            <span className="gorilla-shack-tile__dot" /> THE GORILLA SHACK
          </span>
          <strong className="gorilla-shack-tile__title">
            For more fun and games
          </strong>
        </div>
        <span className="gorilla-shack-tile__arrow" aria-hidden="true">
          <ArrowUpRight size={20} />
        </span>
      </a>

      <a
        href={WILDGROVE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="wildgrove-pill"
        aria-label="Visit Wildgrove — Explore Wildgrove in a new tab"
      >
        <span className="wildgrove-pill__icon" aria-hidden="true">
          <Trees size={26} strokeWidth={2} />
        </span>
        <div className="wildgrove-pill__body">
          <span className="wildgrove-pill__eyebrow">
            <span className="wildgrove-pill__dot" /> WILDGROVE
          </span>
          <strong className="wildgrove-pill__title">
            Explore Wildgrove
          </strong>
        </div>
        <span className="wildgrove-pill__arrow" aria-hidden="true">
          <ArrowUpRight size={20} />
        </span>
      </a>
    </div>
  );
}
