import { EventBus } from '../scripts/services/event-bus.js';
import { AutopsyStore } from '../scripts/services/autopsy-store.js';
import { SettingsService } from '../scripts/services/settings-service.js';
import {
  DEATH_AUTOPSY_EVENT,
  AUTOPSY_TAGGED_EVENT,
  AUTOPSY_SKIPPED_EVENT,
  MATCH_AUTOPSY_SUMMARY_EVENT,
  DEATH_CAUSES,
  DEV_MODE,
} from '../scripts/constants.js';

export { DEATH_CAUSES, DEV_MODE };

export const eventBus = new EventBus();
export const autopsyStore = new AutopsyStore();
export const settingsService = new SettingsService();

let mockMatchId = `mock-${Date.now().toString(36)}`;
let mockRound = 1;
let mockSide: 'attack' | 'defense' = 'attack';
let mockDeaths = 0;

export function simulateDeath() {
  mockDeaths += 1;
  const payload = {
    matchId: mockMatchId,
    round: mockRound,
    side: mockSide,
    score: {
      won: Math.max(0, mockRound - mockDeaths),
      lost: Math.max(0, mockDeaths - 1),
    },
    deaths: mockDeaths,
    source: 'mock',
    timestamp: Date.now(),
  };

  mockRound += 1;
  if (mockRound % 2 === 1) {
    mockSide = mockSide === 'attack' ? 'defense' : 'attack';
  }

  eventBus.trigger(DEATH_AUTOPSY_EVENT, payload);
  return payload;
}

export function simulateTag(causeId: string) {
  const tag = {
    matchId: mockMatchId,
    round: mockRound - 1,
    side: mockSide,
    cause: causeId,
    timestamp: Date.now(),
    skipped: false,
  };
  const entry = autopsyStore.save(tag);
  eventBus.trigger(AUTOPSY_TAGGED_EVENT, tag);
  eventBus.trigger('autopsy-saved', entry);
  return entry;
}

export function endMockMatch() {
  const entries = autopsyStore.listByMatch(mockMatchId);
  const tagged = entries.filter((e: any) => e && !e.skipped && e.cause);
  const topCauses = autopsyStore.getTopCauses(3, tagged);
  const suggestedFocus = topCauses[0]?.cause || null;

  const summary = {
    matchId: mockMatchId,
    outcome: 'defeat',
    taggedCount: tagged.length,
    skippedCount: entries.filter((e: any) => e && e.skipped).length,
    topCauses,
    suggestedFocus,
    source: 'mock',
    timestamp: Date.now(),
  };

  eventBus.trigger(MATCH_AUTOPSY_SUMMARY_EVENT, summary);

  // Reset for next match
  mockMatchId = `mock-${Date.now().toString(36)}`;
  mockRound = 1;
  mockSide = 'attack';
  mockDeaths = 0;

  return summary;
}

export function clearAllData() {
  autopsyStore.clearAll();
}

export function getFocusGoal() {
  return autopsyStore.getFocusGoal();
}

export function setFocusGoal(cause: string | null) {
  autopsyStore.setFocusGoal(cause);
}

export function getAllEntries() {
  return autopsyStore.getAll();
}

export function getCauseCounts() {
  return autopsyStore.aggregateCauseCounts(autopsyStore.getAll());
}

export function getTopCauses(n = 3) {
  return autopsyStore.getTopCauses(n);
}

export { deathDetector, DeathDetector } from './death-detector.js';
export type { DetectionResult, DetectionScenario } from './death-detector.js';

// Re-export constants for convenience
export const LABELS = Object.fromEntries(DEATH_CAUSES.map((c: any) => [c.id, c.label]));
