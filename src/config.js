const env = import.meta.env;

function truthy(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

const firebase = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
};

const hasFirebaseConfig = Boolean(firebase.apiKey && firebase.projectId && firebase.appId);

export const config = {
  appName: env.VITE_APP_NAME || 'FlowPilot AI',
  useMock: truthy(env.VITE_USE_MOCK, !hasFirebaseConfig),
  firebase,
  anthropicConsoleUrl: 'https://console.anthropic.com/settings/keys',
};
