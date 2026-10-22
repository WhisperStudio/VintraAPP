import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  onAuthStateChanged,
  reload,
  signInWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';
import { firebaseAuth } from '@/lib/firebase';

type Session = {
  user: User | null;
  status:
    'loading' | 'signed-out' | 'checking' | 'verified' | 'unverified' | 'error';
  error: string | null;
};
type AuthSession = Session & {
  refresh: (user?: User | null) => Promise<boolean>;
};
const Context = createContext<AuthSession | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({
    user: null,
    status: 'loading',
    error: null,
  });
  const pending = useRef<{ user: User; task: Promise<boolean> } | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(
    (user: User | null = firebaseAuth.currentUser): Promise<boolean> => {
      if (!user) return Promise.resolve(false);
      if (pending.current?.user === user) return pending.current.task;
      setSession({ user, status: 'checking', error: null });
      const task = (async () => {
        try {
          // Reload updates the existing User object in place; publish a new session
          // object so React cannot bail out on a same-reference state update.
          await reload(user);
          if (firebaseAuth.currentUser !== user) return false;
          if (user.emailVerified) await user.getIdToken(true);
          if (!mounted.current || firebaseAuth.currentUser !== user)
            return false;
          setSession({
            user,
            status: user.emailVerified ? 'verified' : 'unverified',
            error: null,
          });
          return user.emailVerified;
        } catch (error) {
          if (mounted.current && firebaseAuth.currentUser === user) {
            setSession({
              user,
              status: 'error',
              error:
                error instanceof Error
                  ? error.message
                  : 'Could not refresh your account.',
            });
          }
          throw error;
        } finally {
          if (pending.current?.user === user) pending.current = null;
        }
      })();
      pending.current = { user, task };
      return task;
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    const start = async () => {
      await firebaseAuth.authStateReady();
      // Finish legacy session restoration before exposing the sign-in form,
      // so stored credentials cannot race a manual sign-in for another account.
      if (!firebaseAuth.currentUser) {
        const raw = await AsyncStorage.getItem('@vintra_creds').catch(
          () => null,
        );
        if (disposed) return;
        if (raw) {
          try {
            const saved = JSON.parse(raw);
            if (
              typeof saved.email === 'string' &&
              typeof saved.password === 'string' &&
              !firebaseAuth.currentUser
            ) {
              await signInWithEmailAndPassword(
                firebaseAuth,
                saved.email,
                saved.password,
              );
            }
          } catch {
            await AsyncStorage.removeItem('@vintra_creds').catch(() => {});
          }
        }
      }
      if (disposed) return;
      unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (!user) {
          pending.current = null;
          setSession({ user: null, status: 'signed-out', error: null });
        } else {
          refresh(user).catch(() => {}); // refresh publishes its error to the UI.
        }
      });
    };
    start().catch((error) => {
      if (!disposed)
        setSession({
          user: firebaseAuth.currentUser,
          status: 'error',
          error:
            error instanceof Error
              ? error.message
              : 'Could not restore your session.',
        });
    });
    return () => {
      disposed = true;
      mounted.current = false;
      unsubscribe?.();
    };
  }, [refresh]);

  useEffect(() => {
    if (session.status !== 'unverified' && session.status !== 'error') return;
    const check = () => {
      if (firebaseAuth.currentUser) refresh().catch(() => {});
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    if (Platform.OS === 'web') window.addEventListener('focus', check);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') window.removeEventListener('focus', check);
    };
  }, [session.status, refresh]);

  return (
    <Context.Provider value={{ ...session, refresh }}>
      {children}
    </Context.Provider>
  );
}

export function useAuthSession() {
  const session = useContext(Context);
  if (!session) throw new Error('useAuthSession requires AuthSessionProvider');
  return session;
}
