import { useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const WIDGET_SCRIPT_SRC = 'https://chat.vintrastudio.com/widget/u2HDFAEu852pJHuxdToHX9nv.js';

const chatWidgetHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        background: transparent;
        overflow: hidden;
      }

      body {
        position: fixed;
        inset: 0;
      }

      body::before {
        content: none !important;
      }

      [data-vintra-widget-key],
      iframe,
      [id*="chat" i],
      [class*="chat" i] {
        z-index: 2147483647 !important;
      }
    </style>
  </head>
  <body>
    <script src="${WIDGET_SCRIPT_SRC}"></script>
    <script>
      function getOpenState() {
        var host = document.querySelector('[data-vintra-widget-key]');
        var root = host && host.shadowRoot;
        var chat = root && root.querySelector('.chat-widget');
        return Boolean(chat && chat.classList.contains('open'));
      }

      function sendState() {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'vintra-chat-state',
          open: getOpenState()
        }));
      }

      function animateTyping(root) {
        var nodes = root.querySelectorAll('[class*="message" i], [class*="bubble" i], [data-role], [data-author]');
        nodes.forEach(function (node) {
          if (node.getAttribute('data-vintra-typed') === 'true') return;
          if (node.querySelector('input, textarea, button')) return;

          var role = String(node.className || '') + ' ' + String(node.dataset && node.dataset.role || '') + ' ' + String(node.dataset && node.dataset.author || '');
          role = role.toLowerCase();
          if (!(role.indexOf('bot') >= 0 || role.indexOf('assistant') >= 0 || role.indexOf('support') >= 0 || role.indexOf('admin') >= 0)) return;

          var targetTextNode = null;
          for (var i = 0; i < node.childNodes.length; i += 1) {
            var child = node.childNodes[i];
            if (child.nodeType === Node.TEXT_NODE && child.textContent && child.textContent.trim()) {
              targetTextNode = child;
              break;
            }
          }

          var targetElement = null;
          if (!targetTextNode) {
            var textChildren = node.querySelectorAll('p, span, div');
            for (var j = 0; j < textChildren.length; j += 1) {
              if (!textChildren[j].children.length && textChildren[j].textContent && textChildren[j].textContent.trim()) {
                targetElement = textChildren[j];
                break;
              }
            }
          }

          var text = (targetTextNode ? targetTextNode.textContent : targetElement && targetElement.textContent || '').trim();
          if (text.length < 2) return;

          node.setAttribute('data-vintra-typed', 'true');
          if (targetTextNode) targetTextNode.textContent = '';
          if (targetElement) targetElement.textContent = '';

          var index = 0;
          var step = Math.max(8, Math.min(24, 900 / text.length));
          var typingTimer = window.setInterval(function () {
            index += 1;
            if (targetTextNode) targetTextNode.textContent = text.slice(0, index);
            if (targetElement) targetElement.textContent = text.slice(0, index);
            if (index >= text.length) window.clearInterval(typingTimer);
          }, step);
        });
      }

      var observer = new MutationObserver(sendState);
      var typingObserver = null;
      var waitForWidget = window.setInterval(function () {
        var host = document.querySelector('[data-vintra-widget-key]');
        var root = host && host.shadowRoot;
        var mount = root && root.querySelector('.vintra-root');

        if (!mount) {
          return;
        }

        window.clearInterval(waitForWidget);
        observer.observe(mount, { attributes: true, childList: true, subtree: true });
        animateTyping(root);
        typingObserver = new MutationObserver(function () { animateTyping(root); });
        typingObserver.observe(root, { childList: true, subtree: true });
        sendState();
      }, 150);
    </script>
  </body>
</html>
`;

export function VintraChatWidget() {
  const [open, setOpen] = useState(false);
  const screen = Dimensions.get('window');
  const width = open ? Math.min(screen.width - 20, 420) : 96;
  const height = open ? Math.min(screen.height - 130, 650) : 96;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={[styles.widgetFrame, { width, height }]}>
        <WebView
          originWhitelist={['*']}
          source={{ html: chatWidgetHtml, baseUrl: 'https://chat.vintrastudio.com' }}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          setSupportMultipleWindows={false}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data) as { type?: string; open?: boolean };

              if (data.type === 'vintra-chat-state') {
                setOpen(Boolean(data.open));
              }
            } catch {
              setOpen(false);
            }
          }}
          style={styles.webView}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: 0,
    bottom: 74,
    zIndex: 1000,
  },
  widgetFrame: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
