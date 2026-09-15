/**
 *   ⚙️  FESTIZE — CLOUD SYNC CONFIG
 *   ================================
 *   Paste the config object from your own Firebase project below.
 *   Get it from:  Firebase Console → Project settings → Your apps → Web app → "SDK setup and configuration"
 *
 *   Steps once, on Firebase side:
 *     1.  Create a Firebase project (free plan is fine).
 *     2.  Enable  Authentication → Sign-in method → Anonymous.
 *     3.  Create a Firestore database (start in production mode).
 *     4.  Paste the rules below into Firestore → Rules → Publish:
 *
 *              rules_version = '2';
 *              service cloud.firestore {
 *                match /databases/{database}/documents {
 *                  match /{document=**} {
 *                    allow read, write: if request.auth != null;
 *                  }
 *                }
 *              }
 *
 *   That's it — every open device signs in anonymously and reads/writes the same fest data live.
 *
 *   If you leave the fields empty, the app keeps working offline with local-only storage,
 *   just like before. Nothing else in the code needs to change.
 */

export const firebaseConfig = {
  apiKey: "AIzaSyAVDhEkcWotSJOnNIvzwfjU-fthlSNF_SY",
  authDomain: "festize-clone.firebaseapp.com",
  databaseURL: "https://festize-clone-default-rtdb.firebaseio.com",
  projectId: "festize-clone",
  storageBucket: "festize-clone.firebasestorage.app",
  messagingSenderId: "613868785481",
  appId: "1:613868785481:web:5b1f13ee6bbf2c0b3a5498"
};

/** True once you've filled in projectId — turns cloud sync on. */
export const CLOUD_ENABLED = !!firebaseConfig.projectId;
