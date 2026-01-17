import React from 'react';
import { createRoot } from 'react-dom/client';
import ContentApp from './ContentApp';
import '../i18n/config';
import styleText from '../index.css?inline';

console.log('Content script loaded');

const rootId = 'chrome-translator-root';
if (!document.getElementById(rootId)) {
  const container = document.createElement('div');
  container.id = rootId;
  // Reset styles for container to avoid inheritance
  container.style.position = 'absolute';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '0';
  container.style.height = '0';
  container.style.zIndex = '2147483647'; // Max z-index
  document.body.appendChild(container);

  const shadowRoot = container.attachShadow({ mode: 'open' });
  
  // Inject styles
  const styleElement = document.createElement('style');
  styleElement.textContent = styleText;
  shadowRoot.appendChild(styleElement);

  const appRoot = document.createElement('div');
  appRoot.classList.remove('light', 'dark');
  appRoot.classList.add(window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  shadowRoot.appendChild(appRoot);

  createRoot(appRoot).render(
    <React.StrictMode>
      <ContentApp />
    </React.StrictMode>
  );
}
