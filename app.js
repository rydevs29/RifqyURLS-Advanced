import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, remove, update, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyChF12-MFH4BMTE9p2HGypUhvFYSDlilbc",
    authDomain: "rifqyurl.firebaseapp.com",
    projectId: "rifqyurl",
    databaseURL: "https://rifqyurl-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- SATPAM DASHBOARD (AUTH GUARD) ---
let currentUser = null;
const urlParamsApp = new URLSearchParams(window.location.search);
const isRedirectMode = urlParamsApp.has('id');

if (!isRedirectMode) {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "/login"; // Tendang ke login jika belum
        } else {
            currentUser = user;
            document.getElementById('userNavbar').classList.remove('hidden');
            document.getElementById('userEmailNav').innerText = user.email;
            document.getElementById('creatorApp').style.display = 'block';
            document.getElementById('creatorApp').classList.add('fade-in');
            loadMyLinks(); // Muat riwayat link
        }
    });
}

// LOGOUT FUNCTION
window.logoutUser = () => {
    signOut(auth).then(() => { window.location.href = "/login"; });
};

// UTILS
async function getIP() { 
    try { 
        const r = await fetch('https://api.ipify.org?format=json');
        const d = await r.json(); 
        return d.ip.replace(/[\.\:]/g, "_");
    } catch(e) { return "unknown_ip"; }
}
function isBot() { return /googlebot|bot|crawler|spider|robot|crawling/i.test(navigator.userAgent); }

// --- 1. CREATE LINK ---
window.shorten = async function() {
    const btn = document.getElementById('btnShorten');
    btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;

    try {
        const ip = await getIP();
        const bannedRef = await get(ref(db, 'firewall/banned_ips/' + ip));
        if(bannedRef.exists()) throw new Error("IP Anda telah di-banned!");

        const longUrl = document.getElementById('longUrl').value.trim();
        const customId = document.getElementById('customId').value.trim().replace(/[^a-zA-Z0-9-_]/g, '');
        
        if(!longUrl) throw new Error("URL Kosong!");
        const urls = longUrl.split(',').map(u=>u.trim()).filter(u=>u.startsWith('http'));
        if(urls.length===0) throw new Error("URL wajib pakai http:// atau https://");

        const shortId = customId || Math.random().toString(36).substring(2,8);
        const check = await get(ref(db, 'links/'+shortId));
        if(check.exists()) throw new Error("Alias sudah dipakai orang lain!");

        let expiryVal = document.getElementById('expiryTime').value;
        let expiryTime = Date.now() + parseInt(expiryVal);
        
        // FITUR PREMIUM (Password Dihapus)
        if(expiryVal === "premium") { 
            expiryTime = 32503680000000; // Langsung permanen tanpa minta pass
        }

        await set(ref(db, 'links/'+shortId), {
            urls: urls, rotatorIndex: 0, createdAt: Date.now(), expiry: expiryTime,
            password: document.getElementById('linkPassword').value.trim() || null,
            maxClicks: parseInt(document.getElementById('maxClicks').value)||0,
            timer: parseInt(document.getElementById('timerSec').value)||0,
            owner: currentUser ? currentUser.uid : 'guest', // Simpan UID Pemilik
            clicks: 0, isReported: false, ip: ip
        });

        const resLink = window.location.origin + "/" + shortId; 
        document.getElementById('shortLink').innerText = resLink;
        document.getElementById('qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(resLink)}`;
        document.getElementById('resultArea').classList.remove('hidden');
        
        loadMyLinks(); // Refresh daftar link

    } catch(e) { alert(e.message); }
    finally { btn.disabled = false; btn.innerHTML = `Buat Link Sekarang <i class="fa-solid fa-bolt"></i>`; }
};

// --- FITUR RIWAYAT & TITIK TIGA ---
async function loadMyLinks() {
    if(!currentUser) return;
    const snap = await get(ref(db, 'links'));
    let html = '';
    
    if(snap.exists()) {
        snap.forEach(child => {
            const data = child.val();
            // Cek apakah link ini milik user yang sedang login
            if(data.owner === currentUser.uid) {
                const shortUrl = window.location.origin + "/" + child.key;
                html += `
                <div class="bg-slate-800/60 p-3 rounded-xl border border-slate-700 flex justify-between items-center relative">
                    <div class="overflow-hidden pr-2">
                        <p class="text-blue-400 font-bold text-sm truncate">${child.key}</p>
                        <p class="text-slate-500 text-[10px] truncate max-w-[150px] sm:max-w-xs">${data.urls[0]}</p>
                        <p class="text-slate-400 text-[10px] mt-1"><i class="fa-solid fa-chart-simple text-blue-500"></i> ${data.clicks} Klik</p>
                    </div>
                    
                    <button onclick="toggleMenu('${child.key}')" class="text-slate-400 hover:text-white px-2 py-1">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>

                    <div id="menu-${child.key}" class="dropdown-menu bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-32 overflow-hidden">
                        <button onclick="copyToClip('${shortUrl}'); toggleMenu('${child.key}')" class="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-blue-400 border-b border-slate-800"><i class="fa-solid fa-copy mr-2"></i> Salin</button>
                        <button onclick="deleteMyLink('${child.key}')" class="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500/20"><i class="fa-solid fa-trash mr-2"></i> Hapus</button>
                    </div>
                </div>`;
            }
        });
    }
    
    document.getElementById('myLinksList').innerHTML = html || '<p class="text-slate-500 text-xs text-center py-4">Belum ada link yang dibuat.</p>';
}

window.toggleMenu = (id) => {
    // Tutup semua menu lain dulu
    document.querySelectorAll('.dropdown-menu').forEach(el => {
        if(el.id !== 'menu-'+id) el.classList.remove('show');
    });
    document.getElementById('menu-'+id).classList.toggle('show');
};

window.copyToClip = (url) => {
    navigator.clipboard.writeText(url);
    alert("Disalin: " + url);
};

window.deleteMyLink = async (id) => {
    if(confirm("Yakin ingin menghapus link ini secara permanen?")) {
        await remove(ref(db, 'links/'+id));
        loadMyLinks(); // Refresh
    }
};

// Tutup menu dropdown jika klik di luar
document.addEventListener('click', (e) => {
    if(!e.target.closest('.relative')) {
        document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('show'));
    }
});


// --- 2. ACCESS LOGIC (REDIRECTOR) ---
const idParam = urlParamsApp.get('id');
if(idParam) {
    document.getElementById('creatorApp').style.display = 'none';
    initRedirect(idParam);
}

async function initRedirect(linkId) {
    if(isBot()) return showError("Bot Detected", "Akses bot ditolak.");
    const snap = await get(ref(db, 'links/'+linkId));
    if(!snap.exists()) return showError("404", "Link tidak ditemukan di database.");

    const data = snap.val();
    if(Date.now() > data.expiry) { await remove(ref(db, 'links/'+linkId)); return showError("Expired", "Link telah kadaluarsa."); }
    renderPreview(data, linkId);
}

function renderPreview(data, linkId) {
    document.getElementById('previewApp').classList.remove('hidden');
    const btn = document.getElementById('btnContinue');
    const targetUrl = Array.isArray(data.urls) ? data.urls[0] : data.urls;

    if(data.password) {
        document.getElementById('visibleUrl').innerText = "🔒 Protected Link";
        document.getElementById('passArea').classList.remove('hidden');
        btn.innerText = "Buka Kunci";
        btn.onclick = () => {
            if(document.getElementById('inputPass').value === data.password) {
                document.getElementById('passArea').classList.add('hidden');
                setupTimerAndRedirect(data, linkId);
            } else {
                document.getElementById('passError').classList.remove('hidden');
            }
        };
    } else {
        document.getElementById('visibleUrl').innerText = targetUrl.length > 40 ? targetUrl.substring(0, 40) + "..." : targetUrl;
        setupTimerAndRedirect(data, linkId);
    }
}

function setupTimerAndRedirect(data, linkId) {
    const btn = document.getElementById('btnContinue');
    if(data.timer > 0) {
        let count = data.timer;
        btn.disabled = true;
        const timerInterval = setInterval(() => {
            btn.innerHTML = `<i class="fa-regular fa-clock"></i> Tunggu... (${count}s)`;
            count--;
            if(count < 0) {
                clearInterval(timerInterval);
                btn.disabled = false;
                btn.innerHTML = `Lanjut ke Tujuan <i class="fa-solid fa-arrow-right"></i>`;
                btn.onclick = () => processRedirect(data, linkId);
            }
        }, 1000);
    } else {
        btn.disabled = false;
        btn.onclick = () => processRedirect(data, linkId);
    }
}

async function processRedirect(data, linkId) {
    document.getElementById('btnContinue').innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Membuka...`;
    await update(ref(db, 'links/'+linkId), { clicks: increment(1) });
    
    let finalUrl = Array.isArray(data.urls) ? data.urls[0] : data.urls;
    if(data.selfDestruct) await remove(ref(db, 'links/'+linkId));

    window.location.href = finalUrl;
}

function showError(t,m) { 
    document.getElementById('previewApp').classList.add('hidden'); 
    document.getElementById('errorApp').classList.remove('hidden'); 
    document.getElementById('errorTitle').innerText=t; 
    document.getElementById('errorDesc').innerText=m;
}
window.copyLink = () => { navigator.clipboard.writeText(document.getElementById('shortLink').innerText); alert("Tersalin!"); };
