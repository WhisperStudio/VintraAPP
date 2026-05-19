import { useEffect } from 'react';

const WIDGET_SCRIPT_ID = 'vintra-solutions-chat-widget';
const WIDGET_SCRIPT_SRC = 'https://chat.vintrastudio.com/widget/u2HDFAEu852pJHuxdToHX9nv.js';
const WIDGET_STYLE_ID = 'vintra-chat-widget-priority-style';
const WIDGET_HOST = 'chat.vintrastudio.com';

function addPriorityStyles() {
  if (document.getElementById(WIDGET_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = WIDGET_STYLE_ID;
  style.textContent = `
    [data-vintra-widget-key],
    iframe[src*="${WIDGET_HOST}"],
    [src*="${WIDGET_HOST}"] {
      z-index: 2147483647 !important;
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

export function VintraChatWidget() {
  useEffect(() => {
    addPriorityStyles();
    loadWebsiteWidgetScript();
  }, []);

  return null;
}
