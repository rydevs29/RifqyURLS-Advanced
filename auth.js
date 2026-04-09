import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, OAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyChF12-MFH4BMTE9p2HGypUhvFYSDlilbc",
    authDomain: "rifqyurl.firebaseapp.com",
    projectId: "rifqyurl",
    databaseURL: "https://rifqyurl-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "rifqyurl.firebasestorage.app",
    messagingSenderId: "772691101649",
    appId: "1:772691101649:web:a856d7e9bea45ba04502f0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// SENTRY: Pantau apakah login berhasil
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Jika akun terdeteksi, langsung pindahkan ke Dashboard utama
        window.location.href = "/";
    }
});

// FUNGSI LOGIN GOOGLE
window.loginGoogle = async () => {
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        // Script tidak perlu melakukan apa-apa di sini, 
        // karena onAuthStateChanged di atas akan langsung mendeteksi dan pindah halaman.
    } catch (error) {
        alert("Gagal masuk dengan Google: " + error.message);
    }
};

// FUNGSI LOGIN MICROSOFT
window.loginMicrosoft = async () => {
    try {
        const provider = new OAuthProvider('microsoft.com');
        await signInWithPopup(auth, provider);
    } catch (error) {
        alert("Gagal masuk dengan Microsoft: " + error.message);
    }
};
