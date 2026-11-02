import type {Polygon} from '../../engine/types.ts';

// Source metres, traced around the owner's town-core boundary; buildings also
// retain a protection margin in the mesher, including future outlying additions.
export const terrainDetail: Polygon = [
  [3100,1540],[3020,1660],[2800,1580],[2200,1530],[1700,1490],
  [1300,1450],[900,1390],[600,1380],[550,1280],[450,1150],
  [300,1000],[180,800],[80,540],[70,240],[150,160],[350,160],
  [650,300],[900,470],[1150,510],[1450,590],[1750,780],
  [1780,920],[2200,950],[2600,980],[2850,980],[2920,1100],
  [2900,1230],[3030,1400],
];
