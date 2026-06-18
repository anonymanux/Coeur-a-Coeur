import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coeuracoeur.app',
  appName: 'Cœur à Cœur',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    GoogleAuth: {
      // Ce Client ID Web sera fourni par la console Google Cloud de Firebase (voir Étape 4)
      scopes: ['profile', 'email'],
      serverClientId: process.env.VITE_GOOGLE_WEB_CLIENT_ID || '',
      forceCodeForRefreshToken: true,
      
    },
    
  },
  android: {
    backgroundColor: "#FFF5F7"
  }
};

export default config;

