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

      var observer = new MutationObserver(sendState);
      var waitForWidget = window.setInterval(function () {
        var host = document.querySelector('[data-vintra-widget-key]');
        var root = host && host.shadowRoot;
        var mount = root && root.querySelector('.vintra-root');

        if (!mount) {
          return;
        }

        window.clearInterval(waitForWidget);
        observer.observe(mount, { attributes: true, childList: true, subtree: true });
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
