export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(eventName, callback) {
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, []);
    }
    this._listeners.get(eventName).push(callback);
  }

  off(eventName, callback) {
    const list = this._listeners.get(eventName);
    if (!list) return;
    this._listeners.set(
      eventName,
      list.filter((cb) => cb !== callback)
    );
  }

  trigger(eventName, payload) {
    const list = this._listeners.get(eventName) || [];
    list.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[EventBus] listener error for ${eventName}`, err);
      }
    });
  }
}
