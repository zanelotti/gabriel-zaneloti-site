import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Sobre from './Sobre';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sobre />
  </StrictMode>
);
