import {buildStepped, kesk1, kesk1Design} from '../city/sillamae/kesk1/index.ts';
import {assemble, kesk5} from '../city/sillamae/kesk5/index.ts';
import {design as kesk5Design} from '../city/sillamae/kesk5/config.ts';
import {id as kesk7Id, kesk7Design} from '../city/sillamae/kesk7/design.ts';
import {createTransfer} from '../city/sillamae/kesk7/model.ts';
import type {BuiltOverride, OverrideContext} from '../engine/types.ts';
import type {StudyModel} from './types.ts';

export interface Editable {
  id: string;
  source: unknown;
  build(context: OverrideContext, design: unknown): StudyModel;
}

const model = (built: BuiltOverride): StudyModel => ({
  root: built.root, setTextures: built.setTextures,
  ready: Promise.all([built.ready, built.root.userData.ready]),
  dispose: () => built.root.userData.dispose(),
});

export const editables = new Map<string, Editable>([
  [kesk1.id, {id: kesk1.id, source: kesk1Design, build: (context, design) => model(buildStepped(context, design as typeof kesk1Design))}],
  [kesk5.id, {id: kesk5.id, source: kesk5Design, build: (context, design) => model(assemble(context, design as typeof kesk5Design))}],
  [kesk7Id, {id: kesk7Id, source: kesk7Design, build: (context, design) => createTransfer(context, 'landing', design as typeof kesk7Design)}],
]);
