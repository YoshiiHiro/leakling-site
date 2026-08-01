export class WindowsService {
  static obtain(name) {
    return new Promise((resolve) => {
      overwolf.windows.obtainDeclaredWindow(name, (result) => resolve(result));
    });
  }

  static restore(name) {
    return new Promise(async (resolve) => {
      const obtained = await WindowsService.obtain(name);
      if (!obtained.success) {
        resolve(obtained);
        return;
      }
      overwolf.windows.restore(obtained.window.id, (result) => resolve(result));
    });
  }

  static show(name) {
    return WindowsService.restore(name);
  }

  static hide(name) {
    return new Promise(async (resolve) => {
      const obtained = await WindowsService.obtain(name);
      if (!obtained.success) {
        resolve(obtained);
        return;
      }
      overwolf.windows.hide(obtained.window.id, (result) => resolve(result));
    });
  }

  static close(name) {
    return new Promise(async (resolve) => {
      const obtained = await WindowsService.obtain(name);
      if (!obtained.success) {
        resolve(obtained);
        return;
      }
      overwolf.windows.close(obtained.window.id, (result) => resolve(result));
    });
  }

  static minimize(name) {
    return new Promise(async (resolve) => {
      const obtained = await WindowsService.obtain(name);
      if (!obtained.success) {
        resolve(obtained);
        return;
      }
      overwolf.windows.minimize(obtained.window.id, (result) => resolve(result));
    });
  }

  static dragMove() {
    overwolf.windows.getCurrentWindow((result) => {
      if (result.success) {
        overwolf.windows.dragMove(result.window.id);
      }
    });
  }

  static getStates() {
    return new Promise((resolve) => {
      overwolf.windows.getWindowsStates((result) => {
        resolve(result.success ? result.resultV2 || result.result : {});
      });
    });
  }

  static isOpen(state) {
    return state === 'normal' || state === 'maximized';
  }
}
