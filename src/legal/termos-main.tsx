import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import Termos from './Termos';
import { trackPageView } from '../services/pageViewTracker';
import '../index.css';

trackPageView();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Termos />
    <Analytics />
  </StrictMode>
);
