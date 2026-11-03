export type SurveyPoint = readonly [x: number, z: number, elevation: number];

export const baseElevation = 15.12;
export const eaves: SurveyPoint[] = [
  [404.64, 640.25, 23.91], [388.02, 673.62, 23.86],
  [376.02, 667.62, 23.77], [384.40, 650.81, 23.75],
  [386.71, 651.97, 25.20], [389.12, 647.12, 25.19],
  [367.21, 636.15, 23.84], [373.45, 625.03, 24.10],
];

export const ridges: SurveyPoint[] = [
  [395.91, 643.21, 27.68], [385.44, 664.37, 27.65], [377.60, 634.06, 27.68],
];

// Eaves 0–7, then the ridge junction and the two hip ends.
export const roofPlanes = [
  [0, 1, 9, 8], [1, 2, 9], [2, 3, 4], [2, 4, 8, 9],
  [4, 5, 8], [5, 6, 8], [6, 10, 8], [6, 7, 10], [7, 0, 8, 10],
];
