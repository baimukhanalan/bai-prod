import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const webApp = window.Telegram?.WebApp;
webApp?.ready();
webApp?.expand();
if (webApp?.initData) {
  webApp.setHeaderColor('#070809');
  webApp.setBackgroundColor('#070809');
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
