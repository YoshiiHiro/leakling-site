export const WINDOW_NAMES = {
  BACKGROUND: 'background',
  DESKTOP: 'desktop',
  IN_GAME: 'in_game'
};

export const HOTKEY_TOGGLE = 'autopsy_showhide';
export const HOTKEY_MOCK_DEATH = 'autopsy_mock_death';

/**
 * MOCK_MODE
 * - true  (default): use desktop Simulate death / End mock match — no live GEP
 * - false: register Valorant GEP and use real death / match_end events
 * Flip this one flag after Overwolf whitelist + live Valorant testing.
 */
export const MOCK_MODE = true;

/**
 * DEV_MODE
 * - true: show Mock tab, debug tools, and development features
 * - false: production mode — hides Mock tab and dev tools
 */
export const DEV_MODE = true;

/** Event bus channels — mock and real GEP both emit DEATH_AUTOPSY */
export const DEATH_AUTOPSY_EVENT = 'DEATH_AUTOPSY';
export const AUTOPSY_TAGGED_EVENT = 'AUTOPSY_TAGGED';
export const AUTOPSY_SKIPPED_EVENT = 'AUTOPSY_SKIPPED';
export const MATCH_AUTOPSY_SUMMARY_EVENT = 'MATCH_AUTOPSY_SUMMARY';
export const OVERLAY_FORCE_DISMISS_EVENT = 'OVERLAY_FORCE_DISMISS';

/** How long the tag overlay stays up after a death */
export const OVERLAY_VISIBLE_MS = 6000;

/** Ignore repeat death events while a tag session is open / just closed */
export const DEATH_AUTOPSY_COOLDOWN_MS = 3000;

export const DEATH_CAUSES = [
  { id: 'crosshair_placement', label: 'Crosshair' },
  { id: 'overpeek', label: 'Overpeek' },
  { id: 'no_utility', label: 'No utility' },
  { id: 'bad_timing', label: 'Bad timing' },
  { id: 'poor_trade', label: 'Poor trade' },
  { id: 'other', label: 'Other' }
];

/** Valorant */
export const VALORANT_CLASS_ID = 21640;

export const SUPPORTED_GAME_IDS = [VALORANT_CLASS_ID];

export const GAME_DISPLAY_NAMES = {
  [VALORANT_CLASS_ID]: 'Valorant'
};

/** Valorant GEP features */
export const GAME_FEATURES = {
  [VALORANT_CLASS_ID]: ['death', 'kill', 'match_info', 'me', 'game_info']
};
