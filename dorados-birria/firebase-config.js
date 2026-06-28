const firebaseConfig = {
  apiKey:            "AIzaSyD9P3fyBYDAKRar-DtS7yQOyk6lru40sRY",
  authDomain:        "dorados-birria.firebaseapp.com",
  projectId:         "dorados-birria",
  storageBucket:     "dorados-birria.firebasestorage.app",
  messagingSenderId: "502732563988",
  appId:             "1:502732563988:web:f57c9b8c63fdd49df46901",
  measurementId:     "G-BEYF0PM5Y4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
