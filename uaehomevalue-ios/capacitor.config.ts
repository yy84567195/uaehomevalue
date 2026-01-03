import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uaehomevalue.app',
  appName: 'UAEHomeValue',
  webDir: 'www',
  server: {
    url: 'https://www.uaehomevalue.com',
    cleartext: false,
  },
};

export default config;
