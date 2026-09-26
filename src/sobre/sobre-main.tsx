import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import Sobre from './Sobre';
import { trackPageView } from '../services/pageViewTracker';
import '../index.css';

trackPageView();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sobre />
    <Analytics />
  </StrictMode>
);
