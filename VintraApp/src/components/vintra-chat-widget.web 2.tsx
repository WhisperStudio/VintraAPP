import { useEffect } from 'react';

const WIDGET_SCRIPT_ID = 'vintra-solutions-chat-widget';
const WIDGET_SCRIPT_SRC = 'https://chat.vintrastudio.com/widget/u2HDFAEu852pJHuxdToHX9nv.js';
const WIDGET_STYLE_ID = 'vintra-chat-widget-priority-style';
const WIDGET_APP_ID = 'vintra-chat-app-button';
const WIDGET_HOST = 'chat.vintrastudio.com';

function bringWebsiteWidgetToFront() {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        `iframe[src*="${WIDGET_HOST}"]`,
        `[src*="${WIDGET_HOST}"]`,
        '[aria-label*="chat" i]',
        '[id*="chat" i]',
        '[class*="chat" i]',
      ].join(','),
    ),
  );

  candidates.forEach((element) => {
    if ([WIDGET_SCRIPT_ID, WIDGET_APP_ID].includes(element.id)) {
      return;
    }

    element.style.zIndex = '2147483646';
    element.style.pointerEvents = 'auto';
  });
}

function addPriorityStyles() {
  if (document.getElementById(WIDGET_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = WIDGET_STYLE_ID;
  style.textContent = `
    iframe[src*="${WIDGET_HOST}"],
    [src*="${WIDGET_HOST}"],
    [aria-label*="chat" i],
    [id*="chat" i],
    [class*="chat" i] {
      z-index: 2147483646 !important;
    }

    #${WIDGET_APP_ID} {
      z-index: 2147483647 !important;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
  `;

  document.head.appendChild(style);
}

function loadWebsiteWidgetScript() {
  if (document.getElementById(WIDGET_SCRIPT_ID)) {
    return;
  }

  const script = document.createElement('script');
  script.id = WIDGET_SCRIPT_ID;
  script.src = WIDGET_SCRIPT_SRC;
  script.async = true;

  document.body.appendChild(script);
}

function findWebsiteLauncher() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        '[aria-label*="chat" i]',
        '[class*="chat" i] button',
        '[id*="chat" i] button',
        '[role="button"][class*="chat" i]',
      ].join(','),
    ),
  ).find((element) => element.id !== WIDGET_APP_ID);
}

function addAppChatButton() {
  if (document.getElementById(WIDGET_APP_ID)) {
    return;
  }

  const button = document.createElement('button');
  button.id = WIDGET_APP_ID;
  button.type = 'button';
  button.setAttribute('aria-label', 'Open Vintra chat');
  button.innerHTML = '<span style="font-size:18px;line-height:1;">+</span><span>Chat</span>';
  button.style.cssText = [
    'position: fixed',
    'right: 18px',
    'bottom: 18px',
    'height: 62px',
    'min-width: 112px',
    'border-radius: 31px',
    'border: 1px solid rgba(255,255,255,0.24)',
    'background: #246cff',
    'color: #ffffff',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'gap: 9px',
    'font: 900 15px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'box-shadow: 0 18px 42px rgba(36,108,255,0.45)',
    'cursor: pointer',
  ].join(';');

  button.addEventListener('click', () => {
    loadWebsiteWidgetScript();
    bringWebsiteWidgetToFront();

    const launcher = findWebsiteLauncher();

    launcher?.click();
  });

  document.body.appendChild(button);
}

export function VintraChatWidget() {
  useEffect(() => {
    addPriorityStyles();
    loadWebsiteWidgetScript();
    addAppChatButton();
    bringWebsiteWidgetToFront();

    const observer = new MutationObserver(bringWebsiteWidgetToFront);
    observer.observe(document.body, { childList: true, subtree: true });

    const interval = window.setInterval(bringWebsiteWidgetToFront, 1000);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
