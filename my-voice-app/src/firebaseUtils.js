// Simple Firebase data storage
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// Save user record (overwrites if exists)
export async function saveUserData(email, data) {
  await setDoc(doc(db, "users", email), data);
}

// Load user record (returns null if not found)
export async function getUserData(email) {
  const docRef = doc(db, "users", email);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}