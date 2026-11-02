export interface AtlasBuildStatus {
  state: 'idle' | 'building' | 'ready' | 'error';
  requested: number;
  completed: number;
  error?: string;
}

export class AtlasBuildQueue {
  #status: AtlasBuildStatus = {state: 'idle', requested: 0, completed: 0};
  #running = false;
  #run: () => Promise<void>;
  constructor(run: () => Promise<void>) { this.#run = run; }
  status(): AtlasBuildStatus { return {...this.#status}; }
  request() {
    this.#status.requested++;
    this.#status.state = 'building';
    delete this.#status.error;
    if (!this.#running) void this.#drain();
    return this.status();
  }
  async #drain() {
    this.#running = true;
    try {
      while (this.#status.completed < this.#status.requested) {
        const version = this.#status.requested;
        try {
          await this.#run();
          this.#status.completed = version;
        } catch (e) {
          // A save during a build invalidates the pipeline fingerprint; retry the newest snapshot.
          if (version !== this.#status.requested) continue;
          this.#status.state = 'error';
          this.#status.error = e instanceof Error ? e.message : String(e);
          return;
        }
      }
      this.#status.state = 'ready';
    } finally { this.#running = false; }
  }
}
