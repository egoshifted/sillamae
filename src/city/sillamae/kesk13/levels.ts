export interface FacadeLevels {
  lower: readonly [number, number];
  upper: readonly [number, number];
  balcony: number;
  plinth: number;
}

// Photo-derived survey elevations; the street reference constrains ratios, not measured dimensions.
export const refinedLevels: FacadeLevels = {
  lower: [16.85, 18.65],
  upper: [20.50, 22.30],
  balcony: 19.80,
  plinth: 15.85,
};
