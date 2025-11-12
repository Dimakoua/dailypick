const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Base class for short-lived Durable Objects that should clear their state
 * after an inactivity window. Subclasses should call `markActive()` whenever
 * meaningful work happens and `markInactive()` when the last client disconnects.
 */
export class BaseEphemeralDO {
  constructor(state, env, options = {}) {
    this.state = state;
    this.env = env;
    this.activityStorageKey = options.activityStorageKey ?? '__ephemeral:lastActive';
    this.deleteAllOnCleanup = options.deleteAllOnCleanup !== false;
    this.ttlMs = this.resolveTtl(options.ttlMs, env);

    // Block until we know the last activity timestamp so alarms behave predictably.
    this.ready = this.state.blockConcurrencyWhile(async () => {
      this.lastActive = await this.state.storage.get(this.activityStorageKey);
      if (!this.lastActive) {
        this.lastActive = Date.now();
        await this.state.storage.put(this.activityStorageKey, this.lastActive);
      }
    });
  }

  resolveTtl(explicitTtl, env) {
    if (typeof explicitTtl === 'number' && explicitTtl > 0) {
      return explicitTtl;
    }
    const fromEnv = Number(env?.SESSION_TTL_MS);
    if (!Number.isNaN(fromEnv) && fromEnv > 0) {
      return fromEnv;
    }
    return DEFAULT_TTL_MS;
  }

  async markActive() {
    await this.ready;
    const now = Date.now();
    this.lastActive = now;
    await this.state.storage.put(this.activityStorageKey, now);
    await this.scheduleCleanup(this.ttlMs);
  }

  async markInactive() {
    await this.ready;
    const now = Date.now();
    this.lastActive = now;
    await this.state.storage.put(this.activityStorageKey, now);
    await this.scheduleCleanup(this.ttlMs);
  }

  async scheduleCleanup(delayMs) {
    const when = Date.now() + Math.max(delayMs, 0);
    await this.state.storage.setAlarm(new Date(when));
    this.log(`Cleanup alarm scheduled for ${new Date(when).toISOString()} (ttl=${this.ttlMs}ms).`);
  }

  async alarm() {
    await this.ready;
    const now = Date.now();
    const elapsed = now - (this.lastActive ?? now);

    if (elapsed < this.ttlMs) {
      // Activity resumed before the alarm fired; reschedule.
      await this.scheduleCleanup(this.ttlMs - elapsed);
      return;
    }

    this.log('Inactivity window elapsed. Running cleanup.');
    await this.onBeforeCleanup();
    if (this.deleteAllOnCleanup) {
      await this.state.storage.deleteAll();
    } else {
      await this.state.storage.delete(this.activityStorageKey);
    }
    await this.onAfterCleanup();
  }

  // Subclasses can override to stop timers or broadcast shutdown notices.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async onBeforeCleanup() {}

  // Subclasses can override for bookkeeping after storage is cleared.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async onAfterCleanup() {}

  log(message, ...args) {
    const id = this.state.id?.toString() ?? 'unknown-do';
    console.log(`[EphemeralDO ${id}] ${message}`, ...args);
  }
}
