import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.b2bprocurement.app',
  appName: 'Kantech',
  webDir: 'public',
  backgroundColor: '#001D4A',
  server: {
    // Points to the live deployed frontend on Vercel
    url: 'https://b2bprocurementui.vercel.app',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#001D4A',
  },
};

export default config;
