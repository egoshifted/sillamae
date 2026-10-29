export class WorldClock {
  #daylight: number;
  #listeners: ((daylight: number) => void)[] = [];

  constructor(daylight: number) {
    this.#daylight = daylight;
  }

  get daylight() {
    return this.#daylight;
  }

  set(daylight: number) {
    this.#daylight = daylight;
    for (const listener of this.#listeners) listener(daylight);
  }

  onChange(listener: (daylight: number) => void) {
    this.#listeners.push(listener);
  }
}
