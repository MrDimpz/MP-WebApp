import { ArrowUpRight } from 'lucide-react';

/**
 * Centralised horizontal tile (30% width on desktop, responsive min-width on mobile)
 * placed below the Solo and Interactive Games tiles, linking to https://thegorillashack.co.uk/
 * Features The Gorilla Shack logo and matching obsidian, electric purple, and solar yellow palette.
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
    </div>
  );
}
