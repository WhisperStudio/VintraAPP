import { useEffect } from 'react';

const WIDGET_SCRIPT_ID = 'vintra-solutions-chat-widget';
const WIDGET_SCRIPT_SRC = 'https://chat.vintrastudio.com/widget/u2HDFAEu852pJHuxdToHX9nv.js';
const WIDGET_STYLE_ID = 'vintra-chat-widget-priority-style';
const WIDGET_HOST = 'chat.vintrastudio.com';
const TYPED_ATTR = 'data-vintra-typed';

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

function animateWidgetMessages(root: ShadowRoot) {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(
    '[class*="message" i], [class*="bubble" i], [data-role], [data-author]',
  ));

  candidates.forEach((node) => {
    if (node.getAttribute(TYPED_ATTR) === 'true') return;
    if (node.querySelector('input, textarea, button')) return;

    const role = `${node.className || ''} ${node.dataset.role || ''} ${node.dataset.author || ''}`.toLowerCase();
    const shouldAnimate = role.includes('bot') || role.includes('assistant') || role.includes('support') || role.includes('admin');
    if (!shouldAnimate) return;

    const textNode = Array.from(node.childNodes).find((child): child is Text => child.nodeType === Node.TEXT_NODE && Boolean(child.textContent?.trim()));
    const textElement = textNode ? null : Array.from(node.querySelectorAll<HTMLElement>('p, span, div')).find((child) => {
      if (child.children.length > 0) return false;
      return Boolean(child.textContent?.trim());
    });

    const text = (textNode?.textContent || textElement?.textContent || '').trim();
    if (text.length < 2) return;

    node.setAttribute(TYPED_ATTR, 'true');
    if (textNode) textNode.textContent = '';
    if (textElement) textElement.textContent = '';

    let index = 0;
    const step = Math.max(8, Math.min(24, 900 / text.length));
    const timer = window.setInterval(() => {
      index += 1;
      if (textNode) textNode.textContent = text.slice(0, index);
      if (textElement) textElement.textContent = text.slice(0, index);
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, step);
  });
}

function watchWidgetTyping() {
  let observer: MutationObserver | null = null;
  const timer = window.setInterval(() => {
    const host = document.querySelector('[data-vintra-widget-key]');
    const root = host?.shadowRoot;
    if (!root) return;

    animateWidgetMessages(root);
    observer = new MutationObserver(() => animateWidgetMessages(root));
    observer.observe(root, { childList: true, subtree: true });
    window.clearInterval(timer);
  }, 200);

  return () => {
    window.clearInterval(timer);
    observer?.disconnect();
  };
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
    return watchWidgetTyping();
  }, []);

  return null;
}
