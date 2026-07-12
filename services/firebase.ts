// services/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// Fix: Use direct named imports for Firestore functions, which is the correct pattern for Firebase v9+ modular SDK.
import { getFirestore, Timestamp } from 'firebase/firestore';

//
// ATENÇÃO: AÇÃO NECESSÁRIA!
//
// Substitua o objeto 'firebaseConfig' abaixo pelas credenciais do SEU projeto Firebase.
// 1. Acesse o Console do Firebase: https://console.firebase.google.com/
// 2. Crie ou selecione seu projeto.
// 3. Clique no ícone de engrenagem (Configurações do projeto) no canto superior esquerdo.
// 4. Na aba "Geral", role para baixo até "Seus apps".
// 5. Clique no ícone da web (</>) para criar um app da web ou selecione um existente.
// 6. Copie o objeto de configuração (firebaseConfig) e cole aqui.
//
const firebaseConfig = {
  apiKey: "AIzaSyB3UoEEI2IHtSQD_LIQ_8p0WVjH98FK0ec",
  authDomain: "gestor-de-escalas-de-anestesia.firebaseapp.com",
  projectId: "gestor-de-escalas-de-anestesia",
  storageBucket: "gestor-de-escalas-de-anestesia.firebasestorage.app",
  messagingSenderId: "997946420775",
  appId: "1:997946420775:web:d2ea7d5b1fe5b4c78ae802",
  measurementId: "G-9EPMGR7N8W"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta as instâncias dos serviços que vamos usar
export const auth = getAuth(app);
// Fix: Use the imported getFirestore function.
export const db = getFirestore(app);
// Fix: Export the imported Timestamp class.
export { Timestamp }; // Export Timestamp class directly
