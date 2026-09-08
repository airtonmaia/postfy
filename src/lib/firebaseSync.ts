import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  isFirebaseConfigured 
} from './firebase';
import { Client, Job, Lead, Proposal, ClientMaterial, TimesheetLog, Workspace } from '../types';

export const saveItemToFirestore = async (colName: string, id: string, data: any) => {
  if (!isFirebaseConfigured()) return;
  try {
    const docRef = doc(db, colName, id);
    // Remove any undefined fields for Firestore compatibility
    const sanitized = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, sanitized, { merge: true });
  } catch (error) {
    console.warn(`Firestore save error on ${colName}/${id}:`, error);
  }
};

export const deleteItemFromFirestore = async (colName: string, id: string) => {
  if (!isFirebaseConfigured()) return;
  try {
    const docRef = doc(db, colName, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn(`Firestore delete error on ${colName}/${id}:`, error);
  }
};

export const fetchCollectionFromFirestore = async <T>(colName: string): Promise<T[]> => {
  if (!isFirebaseConfigured()) return [];
  try {
    const colRef = collection(db, colName);
    const snap = await getDocs(colRef);
    if (snap.empty) return [];
    return snap.docs.map(d => d.data() as T);
  } catch (error) {
    console.warn(`Firestore fetch error on ${colName}:`, error);
    return [];
  }
};

export const seedInitialFirestoreData = async (
  clients: Client[],
  jobs: Job[],
  leads: Lead[],
  proposals: Proposal[],
  clientMaterials: ClientMaterial[],
  timesheetLogs: TimesheetLog[],
  workspaces?: Workspace[]
) => {
  if (!isFirebaseConfigured()) return;
  try {
    // Check if clients already exist
    const snap = await getDocs(collection(db, 'clients'));
    if (!snap.empty) {
      console.log('Firestore already has data, skipping initial seed.');
      return;
    }

    console.log('Seeding initial data to Firebase Firestore...');
    if (workspaces) {
      for (const w of workspaces) {
        await saveItemToFirestore('workspaces', w.id, w);
      }
    }
    for (const c of clients) {
      await saveItemToFirestore('clients', c.id, c);
    }
    for (const j of jobs) {
      await saveItemToFirestore('jobs', j.id, j);
    }
    for (const l of leads) {
      await saveItemToFirestore('leads', l.id, l);
    }
    for (const p of proposals) {
      await saveItemToFirestore('proposals', p.id, p);
    }
    for (const m of clientMaterials) {
      await saveItemToFirestore('client_materials', m.id, m);
    }
    for (const t of timesheetLogs) {
      await saveItemToFirestore('timesheet_logs', t.id, t);
    }
    console.log('Firestore seeding completed successfully.');
  } catch (error) {
    console.warn('Firestore initial seeding error:', error);
  }
};
