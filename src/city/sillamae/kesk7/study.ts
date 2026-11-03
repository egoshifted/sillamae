import {createTransfer} from './model.ts';
import {id} from './design.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

// Owner observation and June 2012 Street View (east): the main entrance has no
// stair, the first balconies sit low and the plinth rises from about 1.0 m at
// the entrance to 1.4 m at the far end of the adjoining wall. Landing seating
// matches these; the survey roof suggests a 0.4 m smaller drop. Provisional.
export const study: StudyDefinition = {
  id,
  stages: {
    transfer: {label: 'Kesk 1 transfer · Kesk 1 seating', build: context => createTransfer(context)},
    draft: {label: 'Kesk 1 transfer · entrance landing at grade', build: context => createTransfer(context, 'landing'), cutsGround: true},
  },
};
