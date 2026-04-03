import {
  doc,
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Pool, PoolMember, Selection } from '../types';

export const poolsCollection = collection(db, 'pools');

export async function createPool(
  name: string,
  createdBy: string,
  createdByName: string,
  lockTime: Date
): Promise<string> {
  const inviteCode = generateInviteCode();
  
  const poolData = {
    name,
    createdBy,
    inviteCode,
    lockTime: Timestamp.fromDate(lockTime),
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(poolsCollection, poolData);

  await addDoc(collection(db, 'pools', docRef.id, 'members'), {
    userId: createdBy,
    userName: createdByName,
    selections: { favorite: null, contender: null, longshot: null },
    totalScore: 0,
    submittedAt: null,
  });

  return docRef.id;
}

export async function joinPoolByCode(
  inviteCode: string,
  userId: string,
  userName: string
): Promise<string | null> {
  const q = query(poolsCollection, where('inviteCode', '==', inviteCode.toUpperCase()));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const poolDoc = snapshot.docs[0];
  const poolId = poolDoc.id;

  const membersRef = collection(db, 'pools', poolId, 'members');
  const memberQuery = query(membersRef, where('userId', '==', userId));
  const memberSnapshot = await getDocs(memberQuery);

  if (!memberSnapshot.empty) {
    return poolId;
  }

  await addDoc(membersRef, {
    userId,
    userName,
    selections: { favorite: null, contender: null, longshot: null },
    totalScore: 0,
    submittedAt: null,
  });

  return poolId;
}

export async function getPool(poolId: string): Promise<Pool | null> {
  const docRef = doc(db, 'pools', poolId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    createdBy: data.createdBy,
    inviteCode: data.inviteCode,
    lockTime: data.lockTime.toDate(),
    createdAt: data.createdAt?.toDate() || new Date(),
  };
}

export async function getUserPools(userId: string): Promise<Pool[]> {
  const membersQuery = query(
    collection(db, 'pools'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(membersQuery);

  const userPools: Pool[] = [];

  for (const poolDoc of snapshot.docs) {
    const membersRef = collection(db, 'pools', poolDoc.id, 'members');
    const memberQuery = query(membersRef, where('userId', '==', userId));
    const memberSnapshot = await getDocs(memberQuery);

    if (!memberSnapshot.empty) {
      const data = poolDoc.data();
      userPools.push({
        id: poolDoc.id,
        name: data.name,
        createdBy: data.createdBy,
        inviteCode: data.inviteCode,
        lockTime: data.lockTime.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
      });
    }
  }

  return userPools;
}

export async function getPoolMembers(poolId: string): Promise<PoolMember[]> {
  const membersRef = collection(db, 'pools', poolId, 'members');
  const snapshot = await getDocs(membersRef);

  return snapshot.docs.map(doc => ({
    userId: doc.data().userId,
    userName: doc.data().userName,
    selections: doc.data().selections,
    totalScore: doc.data().totalScore,
    submittedAt: doc.data().submittedAt?.toDate() || null,
  }));
}

export async function getUserSelections(
  poolId: string,
  userId: string
): Promise<Selection | null> {
  const membersRef = collection(db, 'pools', poolId, 'members');
  const q = query(membersRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const memberData = snapshot.docs[0].data();
  return {
    favorite: memberData.selections?.favorite || undefined,
    contender: memberData.selections?.contender || undefined,
    longshot: memberData.selections?.longshot || undefined,
  };
}

export async function saveSelections(
  poolId: string,
  userId: string,
  selections: Selection
): Promise<void> {
  const membersRef = collection(db, 'pools', poolId, 'members');
  const q = query(membersRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return;
  }

  const memberDocId = snapshot.docs[0].id;
  await updateDoc(doc(db, 'pools', poolId, 'members', memberDocId), {
    selections,
    submittedAt: serverTimestamp(),
  });
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
