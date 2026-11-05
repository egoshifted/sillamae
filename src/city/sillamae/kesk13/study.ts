import { createRoofCorrection, createCourtyardDetails, createProportions, createOrnament, createBuilding, createAccess, createMouldings, createFacade, createDetails, createEnds, createEnvelope, createRoof, createShell, createStreet} from './model.ts';
import {createSeated} from './index.ts';
import type {StudyDefinition} from '../../../studio/types.ts';

export const study: StudyDefinition = {
  id: '213726928',
  stages: {
    finished: {label: 'Finished details and surfaces', build: createSeated},
    shell: {label: 'Plain shell', build: createShell},
    street: {label: 'Street openings', build: createStreet},
    draft: {label: 'Courtyard openings', build: createBuilding},
    ends: {label: 'End elevation openings', build: createEnds},
    envelope: {label: 'Cornice and wall setback', build: createEnvelope},
    roof: {label: 'Roof vents', build: createRoof},
    details: {label: 'Roof stacks and flashing', build: createDetails},
    facade: {label: 'Window frames and balcony rails', build: createFacade},
    mouldings: {label: 'Plaster mouldings and roof finish', build: createMouldings},
    access: {label: 'Downpipes and entrance frames', build: createAccess},
    ornament: {label: 'Decorated bays and projecting plinth', build: createOrnament},
    proportions: {label: 'Corrected window levels and plinth', build: createProportions},
    courtyard: {label: 'Courtyard alignment and decoration', build: createCourtyardDetails},
    roofline: {label: 'Corrected wing eaves and recessed roof', build: createRoofCorrection},
  },
};
