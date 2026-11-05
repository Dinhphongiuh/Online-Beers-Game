import {createRoot} from 'react-dom/client';
import Root from './Root.tsx';
import { BackendGate } from './components/BackendGate.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <BackendGate>
    <Root />
  </BackendGate>
);
