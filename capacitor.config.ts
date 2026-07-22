import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dianoose.stage',
  appName: 'Dianoose Stage',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      providers: ['apple.com', 'google.com'],
      // false makes the native plugin sign into the native (Keychain) Firebase Auth SDK itself
      // as well as returning the credential to us — for Apple specifically, that consumes the
      // single-use nonce+idToken pair, so our own subsequent signInWithCredential() on the JS SDK
      // gets rejected as a duplicate. true skips that native-side sign-in entirely and just
      // returns the raw credential, leaving our JS-side signInWithCredential() as the only consumer.
      skipNativeAuth: true,
    },
  },
};

export default config;
