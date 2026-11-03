export interface AtlasBuildStatus {
  state: 'idle' | 'pending' | 'building' | 'ready' | 'error';
  error?: string;
}

export class AtlasBuildQueue {
  #status: AtlasBuildStatus = {state: 'idle'};
  #revision = 0;
  #run: () => Promise<void>;
  constructor(run: () => Promise<void>) { this.#run = run; }
  status(): AtlasBuildStatus { return {...this.#status}; }
  saved() {
    this.#revision++;
    if (this.#status.state !== 'building') this.#status = {state: 'pending'};
  }
  request() {
    if (this.#status.state !== 'building') void this.#build();
    return this.status();
  }
  async #build() {
    const revision = this.#revision;
    this.#status = {state: 'building'};
    try {
      await this.#run();
      this.#status = {state: revision === this.#revision ? 'ready' : 'pending'};
    } catch (e) {
      this.#status = {state: 'error', error: e instanceof Error ? e.message : String(e)};
    }
  }
}
