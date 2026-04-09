import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, OAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyChF12-MFH4BMTE9p2HGypUhvFYSDlilbc",
    authDomain: "rifqyurl.firebaseapp.com",
    projectId: "rifqyurl",
    // Sesuaikan dengan config kamu
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Otomatis pindah ke index jika sudah login
onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname.includes('login.html')) {
        if (user.email === 'invite.rifqydev@gmail.com') {
            // Jika admin login, bisa pilih ke index atau admin (default ke index dulu)
            window.location.href = "index.html"; 
        } else {
            window.location.href = "index.html";
        }
    }
});

window.loginGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => alert("Login Gagal: " + err.message));
};

window.loginMicrosoft = () => {
    const provider = new OAuthProvider('microsoft.com');
    signInWithPopup(auth, provider).catch(err => alert("Login Gagal: " + err.message));
};
