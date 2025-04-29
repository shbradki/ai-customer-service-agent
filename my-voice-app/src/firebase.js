// Firebase configuration
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {

    apiKey: "AIzaSyChhQbhjOu8VWotKQug829557PglsvSmBA",
  
    authDomain: "ai-customer-service-fdd11.firebaseapp.com",
  
    projectId: "ai-customer-service-fdd11",
  
    storageBucket: "ai-customer-service-fdd11.firebasestorage.app",
  
    messagingSenderId: "696457509364",
  
    appId: "1:696457509364:web:f1bb53d8b062e3e7e5a1a1"
  
  };
  
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
  
export { db };