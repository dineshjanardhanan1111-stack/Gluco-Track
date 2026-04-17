import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  serverTimestamp,
  getDoc,
  setDoc,
  getDocs
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase';
import { GlucoseReading, MealLog, MedicationLog, UserProfile } from '../types';

// Mock DB for when Firebase is not configured
const MOCK_DB: Record<string, any[]> = {
  glucose: [],
  meals: [],
  medications: []
};

const getLocalStorage = (key: string) => {
  const data = localStorage.getItem(`glucotrack_${key}`);
  return data ? JSON.parse(data) : [];
};

const setLocalStorage = (key: string, data: any) => {
  localStorage.setItem(`glucotrack_${key}`, JSON.stringify(data));
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app we might throw, but here we want to continue if possible
  return null;
}

export const dbService = {
  // --- USERS ---
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!isFirebaseConfigured()) {
      const users = getLocalStorage('users');
      return users.find((u: any) => u.uid === uid) || null;
    }
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
      return null;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `users/${uid}`);
      return null;
    }
  },

  async saveUserProfile(profile: UserProfile): Promise<void> {
    if (!isFirebaseConfigured()) {
      const users = getLocalStorage('users');
      const idx = users.findIndex((u: any) => u.uid === profile.uid);
      if (idx >= 0) users[idx] = profile;
      else users.push(profile);
      setLocalStorage('users', users);
      return;
    }
    try {
      await setDoc(doc(db, 'users', profile.uid), profile);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${profile.uid}`);
    }
  },

  // --- GLUCOSE ---
  async addGlucose(reading: Omit<GlucoseReading, 'id'>): Promise<string | null> {
    if (!isFirebaseConfigured()) {
      const data = getLocalStorage('glucose');
      const id = Math.random().toString(36).substr(2, 9);
      data.push({ ...reading, id });
      setLocalStorage('glucose', data);
      return id;
    }
    try {
      const docRef = await addDoc(collection(db, 'glucose_readings'), {
        ...reading,
        timestamp: Timestamp.fromDate(reading.timestamp instanceof Date ? reading.timestamp : new Date(reading.timestamp))
      });
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'glucose_readings');
      return null;
    }
  },

  subscribeGlucose(userId: string, callback: (readings: GlucoseReading[]) => void) {
    if (!isFirebaseConfigured()) {
      const data = getLocalStorage('glucose').filter((r: any) => r.userId === userId);
      callback(data.map((r: any) => ({ ...r, timestamp: new Date(r.timestamp) })));
      return () => {};
    }
    const q = query(
      collection(db, 'glucose_readings'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const readings = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        timestamp: (doc.data().timestamp as Timestamp).toDate()
      })) as GlucoseReading[];
      callback(readings);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'glucose_readings'));
  },

  // --- MEALS ---
  async addMeal(meal: Omit<MealLog, 'id'>): Promise<string | null> {
    if (!isFirebaseConfigured()) {
      const data = getLocalStorage('meals');
      const id = Math.random().toString(36).substr(2, 9);
      data.push({ ...meal, id });
      setLocalStorage('meals', data);
      return id;
    }
    try {
      const docRef = await addDoc(collection(db, 'meals'), {
        ...meal,
        timestamp: Timestamp.fromDate(meal.timestamp instanceof Date ? meal.timestamp : new Date(meal.timestamp))
      });
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'meals');
      return null;
    }
  },

  subscribeMeals(userId: string, callback: (meals: MealLog[]) => void) {
    if (!isFirebaseConfigured()) {
      const data = getLocalStorage('meals').filter((r: any) => r.userId === userId);
      callback(data.map((r: any) => ({ ...r, timestamp: new Date(r.timestamp) })));
      return () => {};
    }
    const q = query(
      collection(db, 'meals'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const meals = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        timestamp: (doc.data().timestamp as Timestamp).toDate()
      })) as MealLog[];
      callback(meals);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'meals'));
  },

  // --- MEDICATIONS ---
  async addMedication(med: Omit<MedicationLog, 'id'>): Promise<string | null> {
    if (!isFirebaseConfigured()) {
      const data = getLocalStorage('medications');
      const id = Math.random().toString(36).substr(2, 9);
      data.push({ ...med, id });
      setLocalStorage('medications', data);
      return id;
    }
    try {
      const docRef = await addDoc(collection(db, 'medications'), {
        ...med,
        timestamp: Timestamp.fromDate(med.timestamp instanceof Date ? med.timestamp : new Date(med.timestamp))
      });
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'medications');
      return null;
    }
  },

  subscribeMedications(userId: string, callback: (meds: MedicationLog[]) => void) {
    if (!isFirebaseConfigured()) {
      const data = getLocalStorage('medications').filter((r: any) => r.userId === userId);
      callback(data.map((r: any) => ({ ...r, timestamp: new Date(r.timestamp) })));
      return () => {};
    }
    const q = query(
      collection(db, 'medications'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const meds = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        timestamp: (doc.data().timestamp as Timestamp).toDate()
      })) as MedicationLog[];
      callback(meds);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'medications'));
  }
};
