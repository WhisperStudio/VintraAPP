import { useState } from 'react';
import { Linking, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

const WIDGET_SCRIPT_SRC = 'https://chat.vintrastudio.com/widget/u2HDFAEu852pJHuxdToHX9nv.js';
const CHAT_APP_URL = 'https://chat.vintrastudio.com/widget/u2HDFAEu852pJHuxdToHX9nv';

function getWebView() {
  try {
    return require('react-native-webview').WebView;
  } catch {
    return null;
  }
}

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
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        display: block;
        pointer-events: none;
      }

      iframe,
      [id*="chat" i],
      [class*="chat" i] {
        z-index: 2147483647 !important;
      }
    </style>
  </head>
  <body>
    <script>
      fetch('${WIDGET_SCRIPT_SRC}', { cache: 'no-store' })
        .then(function (response) { return response.text(); })
        .then(function (code) {
          var patchedCode = code.replace('var FORCE_OPEN = false;', 'var FORCE_OPEN = true;');
          var script = document.createElement('script');
          script.text = patchedCode;
          document.body.appendChild(script);
        })
        .catch(function () {
          var script = document.createElement('script');
          script.src = '${WIDGET_SCRIPT_SRC}';
          document.body.appendChild(script);
        });
    </script>
  </body>
</html>
`;

export function VintraChatWidget() {
  const [open, setOpen] = useState(false);
  const WebView = getWebView();

  return (
    <>
      <Pressable style={styles.nativeButton} onPress={() => setOpen(true)}>
        <Text style={styles.nativeIcon}>+</Text>
        <Text style={styles.nativeText}>Chat</Text>
      </Pressable>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={styles.webViewLayer}>
            {WebView ? (
              <WebView
                originWhitelist={['*']}
                source={{ html: chatWidgetHtml, baseUrl: 'https://chat.vintrastudio.com' }}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                scrollEnabled={false}
                setSupportMultipleWindows={false}
                style={styles.webView}
              />
            ) : (
              <View style={styles.fallback}>
                <Text style={styles.fallbackTitle}>Chat needs a fresh app build</Text>
                <Text style={styles.fallbackText}>
                  WebView is installed, but this dev app was built before it was added.
                </Text>
                <Pressable style={styles.fallbackButton} onPress={() => Linking.openURL(CHAT_APP_URL)}>
                  <Text style={styles.fallbackButtonText}>Open chat for now</Text>
                </Pressable>
              </View>
            )}
          </View>
          <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
            <Text style={styles.closeText}>x</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  nativeButton: {
    position: 'absolute',
    right: 18,
    bottom: 92,
    zIndex: 1000,
    minWidth: 104,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#246cff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#246cff',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  nativeIcon: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '900',
  },
  nativeText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  closeButton: {
    position: 'absolute',
    top: 58,
    right: 18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(6,17,31,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  closeText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webViewLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  fallback: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#06111f',
  },
  fallbackTitle: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  fallbackText: {
    color: '#bdc9dc',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 280,
  },
  fallbackButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#246cff',
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  fallbackButtonText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
});
