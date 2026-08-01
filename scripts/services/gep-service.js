const MAX_RETRIES = 12;
const RETRY_DELAY_MS = 2000;

export class GepService {
  static setRequiredFeatures(features, onEvents, onInfo) {
    let attempts = 0;

    const tryRegister = () => {
      overwolf.games.events.setRequiredFeatures(features, (result) => {
        if (!result.success) {
          attempts += 1;
          console.warn(
            `[GEP] setRequiredFeatures failed (${attempts}/${MAX_RETRIES}):`,
            result.error || result
          );
          if (attempts < MAX_RETRIES) {
            setTimeout(tryRegister, RETRY_DELAY_MS);
          }
          return;
        }

        console.log('[GEP] features registered:', result.supportedFeatures);

        overwolf.games.events.onNewEvents.removeListener(onEvents);
        overwolf.games.events.onInfoUpdates2.removeListener(onInfo);
        overwolf.games.events.onNewEvents.addListener(onEvents);
        overwolf.games.events.onInfoUpdates2.addListener(onInfo);

        overwolf.games.events.getInfo((infoResult) => {
          if (infoResult.success && infoResult.res) {
            onInfo({ info: infoResult.res });
          }
        });
      });
    };

    tryRegister();
  }
}
