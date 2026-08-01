import { SUPPORTED_GAME_IDS } from '../constants.js';

export class RunningGameService {
  getRunningGameInfo() {
    return new Promise((resolve) => {
      overwolf.games.getRunningGameInfo((info) => resolve(info || null));
    });
  }

  async isSupportedGameRunning() {
    const info = await this.getRunningGameInfo();
    return Boolean(
      info &&
        info.isRunning &&
        info.classId &&
        SUPPORTED_GAME_IDS.includes(info.classId)
    );
  }

  addGameRunningChangedListener(callback) {
    overwolf.games.onGameInfoUpdated.addListener((event) => {
      const running =
        event &&
        event.gameInfo &&
        event.gameInfo.isRunning &&
        SUPPORTED_GAME_IDS.includes(event.gameInfo.classId);

      if (event.runningChanged || event.gameChanged) {
        callback(Boolean(running), event.gameInfo || null);
      }
    });
  }
}
