import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyChF12-MFH4BMTE9p2HGypUhvFYSDlilbc",
    authDomain: "rifqyurl.firebaseapp.com",
    projectId: "rifqyurl",
    databaseURL: "https://rifqyurl-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// SENTRY: Pengecekan Admin
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email === "invite.rifqydev@gmail.com") {
            document.getElementById('loadingAuth').style.display = 'none';
            document.getElementById('adminApp').classList.remove('hidden');
            document.getElementById('adminEmail').innerText = "Logged in as: " + user.email;
            loadVouchers();
            loadStats();
        } else {
            // Bukan kamu? Tendang ke forbidden!
            window.location.href = "forbidden.html";
        }
    } else {
        window.location.href = "login.html";
    }
});

window.logoutAdmin = () => {
    signOut(auth).then(() => window.location.href = "login.html");
};

// Generate Voucher Unik
window.generateVoucher = async () => {
    const type = document.getElementById('voucherType').value;
    const prefix = type === 'architect' ? 'ARCH-' : 'GRDN-';
    const code = prefix + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    await set(ref(db, 'vouchers/' + code), {
        type: type,
        status: 'active',
        createdAt: Date.now()
    });
    alert(`Voucher ${code} berhasil dibuat!`);
};

// Realtime Load Vouchers
function loadVouchers() {
    onValue(ref(db, 'vouchers'), (snapshot) => {
        let html = '';
        snapshot.forEach(child => {
            const data = child.val();
            if(data.status === 'active') {
                const color = data.type === 'architect' ? 'text-yellow-400' : 'text-blue-400';
                html += `<div class="bg-slate-800/80 p-2 rounded-lg border border-slate-700 flex justify-between items-center text-xs">
                    <span class="font-mono font-bold ${color}">${child.key}</span>
                    <span class="uppercase font-bold text-slate-500">${data.type}</span>
                </div>`;
            }
        });
        document.getElementById('voucherList').innerHTML = html || '<p class="text-slate-500 text-xs">Tidak ada voucher aktif.</p>';
    });
}

function loadStats() {
    onValue(ref(db, 'links'), (snap) => {
        document.getElementById('statLinks').innerText = snap.size || 0;
    });
    onValue(ref(db, 'firewall/banned_ips'), (snap) => {
        document.getElementById('statBans').innerText = snap.size || 0;
    });
}
