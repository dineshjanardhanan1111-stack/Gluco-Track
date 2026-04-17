import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, getDocFromServer, doc } from 'firebase/firestore';

// Default configuration with placeholders
// In a real environment, this would be updated by the set_up_firebase tool.
// We provide a way to safely load it as a module or fallback gracefully.
import firebaseConfigImport from './firebase-applet-config.json';

const firebaseConfig = firebaseConfigImport as any;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const googleProvider = new GoogleAuthProvider();

export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey && 
         firebaseConfig.apiKey !== "PLACEHOLDER" && 
         firebaseConfig.projectId && 
         firebaseConfig.projectId !== "PLACEHOLDER";
};

// Connection test
if (typeof window !== 'undefined' && isFirebaseConfigured()) {
  const testConnection = async () => {
    try {
      await getDocFromServer(doc(db, '_health', 'connection'));
      console.log("Firebase connection established.");
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Firebase connection failed: Client is offline or configuration is incorrect.");
      }
    }
  };
  testConnection();
}
