import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { requestNotificationAccess, sendLocalNotification } from '@/lib/notifications';

const OWNER_PIN = 'VINTRA';

export default function OwnerScreen() {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [title, setTitle] = useState('Vintra update');
  const [body, setBody] = useState('A new app update is ready to preview.');
  const [pushToken, setPushToken] = useState('');
  const [sending, setSending] = useState(false);

  function unlock() {
    if (pin.trim().toUpperCase() === OWNER_PIN) {
      setUnlocked(true);
      return;
    }

    Alert.alert('Wrong PIN', 'Use the owner PIN to open notification tools.');
  }

  async function enableNotifications() {
    const result = await requestNotificationAccess();

    if (result.token) {
      setPushToken(result.token);
    }

    Alert.alert(result.granted ? 'Ready' : 'Not enabled', result.message);
  }

  async function sendTestNotification() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Missing text', 'Add both a title and a message.');
      return;
    }

    setSending(true);

    try {
      await requestNotificationAccess();
      await sendLocalNotification(title.trim(), body.trim());
      Alert.alert('Notification sent', 'Test notification was sent to this device.');
    } catch (error) {
      Alert.alert(
        'Could not send notification',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.five },
        ]}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <SymbolView name={{ ios: 'bell.badge.fill', android: 'notifications', web: 'notifications' }} size={24} tintColor="#ffffff" />
          </View>
          <ThemedText style={styles.kicker}>Owner tools</ThemedText>
          <ThemedText style={styles.title}>Send app notifications</ThemedText>
          <ThemedText style={styles.lead}>
            Enable notifications, write a short update and send a test push from the app.
          </ThemedText>
        </View>

        {!unlocked ? (
          <View style={styles.panel}>
            <ThemedText style={styles.panelTitle}>Owner access</ThemedText>
            <TextInput
              value={pin}
              onChangeText={setPin}
              placeholder="Enter owner PIN"
              placeholderTextColor="#71809a"
              autoCapitalize="characters"
              secureTextEntry
              style={styles.input}
            />
            <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={unlock}>
              <ThemedText style={styles.buttonText}>Unlock</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View>
                <ThemedText style={styles.panelTitle}>Notification composer</ThemedText>
                <ThemedText style={styles.panelMeta}>Audience: this device for now</ThemedText>
              </View>
              <Pressable style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]} onPress={enableNotifications}>
                <ThemedText style={styles.smallButtonText}>Enable</ThemedText>
              </Pressable>
            </View>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Notification title"
              placeholderTextColor="#71809a"
              style={styles.input}
            />
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Message"
              placeholderTextColor="#71809a"
              multiline
              style={[styles.input, styles.textArea]}
            />

            <Pressable
              style={({ pressed }) => [styles.button, sending && styles.buttonDisabled, pressed && styles.pressed]}
              disabled={sending}
              onPress={sendTestNotification}>
              <ThemedText style={styles.buttonText}>{sending ? 'Sending...' : 'Send test notification'}</ThemedText>
            </Pressable>

            <View style={styles.note}>
              <ThemedText style={styles.noteTitle}>Next step for real broadcasts</ThemedText>
              <ThemedText style={styles.noteText}>
                To send to every user, the app must save Expo push tokens to a backend and this
                screen must call a secure admin endpoint.
              </ThemedText>
              {pushToken ? <ThemedText style={styles.tokenText}>{pushToken}</ThemedText> : null}
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06111f',
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.four,
  },
  header: {
    alignItems: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: '#246cff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
    shadowColor: '#246cff',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
  },
  kicker: {
    color: '#7da8ff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: '#ffffff',
    fontSize: 42,
    lineHeight: 47,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  lead: {
    color: '#bdc9dc',
    fontSize: 16,
    lineHeight: 25,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 520,
    marginTop: Spacing.two,
  },
  panel: {
    borderRadius: 28,
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    gap: Spacing.three,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  panelTitle: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  panelMeta: {
    color: '#9fb1ce',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginTop: 3,
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    color: '#06111f',
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontWeight: '800',
  },
  textArea: {
    minHeight: 120,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
  button: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: '#246cff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#246cff',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  buttonDisabled: {
    opacity: 0.62,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  smallButton: {
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    color: '#06111f',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  note: {
    borderRadius: 20,
    padding: Spacing.three,
    backgroundColor: 'rgba(6,17,31,0.58)',
    gap: 6,
  },
  noteTitle: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  noteText: {
    color: '#bdc9dc',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  tokenText: {
    color: '#7da8ff',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.74,
  },
});
