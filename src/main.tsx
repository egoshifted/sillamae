import {createRoot} from 'react-dom/client';
import {App} from './app/App.tsx';
import {openTown} from './app/town.ts';

openTown(document.querySelector('#view')!);
createRoot(document.querySelector('#root')!).render(<App/>);
