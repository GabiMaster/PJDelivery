import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function credential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  return applicationDefault();
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'pj-delivery-local';
const app = getApps()[0] || initializeApp({ credential: credential(), projectId });
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export { FieldValue };

export async function authenticatedUser(authorization) {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw Object.assign(new Error('Iniciá sesión para continuar'), { status: 401 });
  const decoded = await auth.verifyIdToken(token);
  const profile = await firestore.collection('cashiers').doc(decoded.uid).get();
  if (!profile.exists || profile.data().active === false) throw Object.assign(new Error('El usuario no está habilitado'), { status: 403 });
  return { uid: decoded.uid, email: decoded.email, ...profile.data() };
}
