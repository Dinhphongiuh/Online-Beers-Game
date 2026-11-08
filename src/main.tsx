import {createRoot} from 'react-dom/client';
import Root from './Root.tsx';
import { BackendGate } from './components/BackendGate.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <BackendGate>
      <Root />
    </BackendGate>
  </AppErrorBoundary>
);
