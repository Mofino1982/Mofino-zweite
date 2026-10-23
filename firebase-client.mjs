import {getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import {getFirestore} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {getFunctions} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js';
export const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp({apiKey:'AIzaSyDybfM0XPrpohdWvZF8X8xgP3mdCo6OuzI',authDomain:'mo-fino.firebaseapp.com',projectId:'mo-fino',appId:'1:279668714255:web:6ca341d3d6e3a472d5ec7a'});
export const auth=getAuth(app),db=getFirestore(app),functions=getFunctions(app,'europe-west3');
