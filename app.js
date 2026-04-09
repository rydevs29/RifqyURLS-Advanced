import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, remove, update, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const db = getDatabase(app);
const auth = getAuth(app); // Inisialisasi Auth

// --- SATPAM DASHBOARD (AUTH GUARD) ---
const urlParamsApp = new URLSearchParams(window.location.search);
const isRedirectMode = urlParamsApp.has('id');

// Jika sedang membuka halaman utama (bukan sedang klik link pendek)
if (!isRedirectMode) {
    // Sembunyikan form creator sampai dicek
    document.getElementById('creatorApp').style.display = 'none'; 
    
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            // JIKA BELUM LOGIN: Tendang ke halaman login!
            window.location.href = "/login";
        } else {
            // JIKA SUDAH LOGIN: Tampilkan Dashboard
            document.getElementById('creatorApp').style.display = 'block';
            document.getElementById('creatorApp').classList.add('fade-in');
        }
    });
}


// --- UTILS FIX (Bug Limit 5x jadi 10x fixed here) ---
async function getIP() { 
    try { 
        const r = await fetch('https://api.ipify.org?format=json');
        const d = await r.json(); 
        // Ganti semua titik dan TITIK DUA (IPv6) jadi underscore biar key valid
        return d.ip.replace(/[\.\:]/g, "_");
    } catch(e) { return "unknown_ip"; }
}
async function getGeo() { try{const r=await fetch('https://ipapi.co/json/');const d=await r.json();return d.country_code;}catch(e){return "XX";}}
function isBot() { return /googlebot|bot|crawler|spider|robot|crawling/i.test(navigator.userAgent); }

// --- 1. CREATE LINK ---
window.shorten = async function() {
    const btn = document.getElementById('btnShorten');
    btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;

    try {
        // Firewall Check
        const ip = await getIP();
        const bannedRef = await get(ref(db, 'firewall/banned_ips/' + ip));
        if(bannedRef.exists()) throw new Error("IP Anda telah di-banned oleh Admin!");

        const longUrl = document.getElementById('longUrl').value.trim();
        const customId = document.getElementById('customId').value.trim().replace(/[^a-zA-Z0-9-_]/g, '');
        
        // IP Limit Logic Fixed
        const limitRef = ref(db, 'user_limits/' + ip);
        const snapshot = await get(limitRef);
        const SEVEN_DAYS = 604800000;
        let userData = snapshot.val() || { count: 0, startTime: Date.now() };

        if (Date.now() - userData.startTime > SEVEN_DAYS) userData = { count: 0, startTime: Date.now() };
        if (userData.count >= 5) throw new Error("Limit 5 Link/Minggu tercapai!");

        if(!longUrl) throw new Error("URL Kosong!");
        const urls = longUrl.split(',').map(u=>u.trim()).filter(u=>u.startsWith('http'));
        if(urls.length===0) throw new Error("URL tidak valid!");

        const shortId = customId || Math.random().toString(36).substring(2,8);
        const check = await get(ref(db, 'links/'+shortId));
        if(check.exists()) throw new Error("Alias terpakai!");

        let expiryVal = document.getElementById('expiryTime').value;
        let expiryTime = Date.now() + parseInt(expiryVal);
        if(expiryVal==="premium") { 
            if(prompt("Pass Owner:")!=="RifqyQPP28!@") throw new Error("Gagal");
            expiryTime=32503680000000; 
        }

        await set(ref(db, 'links/'+shortId), {
            urls: urls, rotatorIndex: 0, createdAt: Date.now(), expiry: expiryTime,
            password: document.getElementById('linkPassword').value.trim() || null,
            maxClicks: parseInt(document.getElementById('maxClicks').value)||0,
            timer: parseInt(document.getElementById('timerSec').value)||0,
            uaBlock: document.getElementById('uaBlock').value || null,
            selfDestruct: document.getElementById('isOneTime').checked,
            cloaking: document.getElementById('isCloaked').checked,
            countries: document.getElementById('geoBlock').value.toUpperCase().split(',').map(c=>c.trim()).filter(c=>c.length===2),
            whitelistMode: document.getElementById('isWhitelist').checked,
            clicks: 0, isReported: false,
            ip: ip // Simpan IP creator untuk keperluan Ban nanti
        });

        // Update Limit (Tunggu sampai save sukses baru update)
        userData.count++;
        await set(limitRef, userData);

        const resLink = window.location.origin + "/" + shortId; 
        document.getElementById('shortLink').innerText = resLink;
        document.getElementById('qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(resLink)}`;
        document.getElementById('resultArea').classList.remove('hidden');

    } catch(e) { alert(e.message); }
    finally { btn.disabled = false; btn.innerHTML = `Buat Link Sekarang <i class="fa-solid fa-bolt"></i>`; }
};

// --- 2. ACCESS LOGIC ---
const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');

if(id) {
    document.getElementById('creatorApp').style.display = 'none';
    initRedirect();
}

async function initRedirect() {
    // Firewall Check (Clicker)
    const ip = await getIP();
    const bannedRef = await get(ref(db, 'firewall/banned_ips/' + ip));
    if(bannedRef.exists()) return showError("Access Denied", "IP Anda diblokir oleh sistem keamanan.");

    if(isBot()) return showError("Bot Detected", "Akses bot ditolak.");
    const snap = await get(ref(db, 'links/'+id));
    if(!snap.exists()) return showError("404", "Link tidak ditemukan.");

    const data = snap.val();

    if(data.isReported) return showError("Reported", "Link berbahaya.");
    if(Date.now() > data.expiry) { await remove(ref(db, 'links/'+id)); return showError("Expired", "Link kadaluarsa."); }
    if(data.maxClicks>0 && data.clicks>=data.maxClicks) return showError("Limit", "Kuota klik habis.");
    
    // UA & Geo Check
    if(data.uaBlock && data.uaBlock.split(',').some(b=>navigator.userAgent.toLowerCase().includes(b.trim().toLowerCase()))) return showError("Blocked", "Browser tidak diizinkan.");
    if(data.countries && data.countries.length > 0) {
        const geo = await getGeo();
        if((data.whitelistMode && !data.countries.includes(geo)) || (!data.whitelistMode && data.countries.includes(geo))) return showError("Geo Restriction", "Lokasi tidak diizinkan.");
    }

    renderPreview(data);
}

function renderPreview(data) {
    document.getElementById('previewApp').classList.remove('hidden');
    const btn = document.getElementById('btnContinue');
    const urlDisplay = document.getElementById('visibleUrl');
    
    const targetUrl = Array.isArray(data.urls) ? data.urls[0] : data.urls;

    if(data.password) {
        // MODE PASSWORD
        urlDisplay.innerText = "🔒 Protected Link (Hidden)";
        document.getElementById('prevTitle').innerText = "Link Terkunci";
        document.getElementById('passArea').classList.remove('hidden');
        
        btn.innerText = "Buka Kunci";
        btn.onclick = () => {
            const input = document.getElementById('inputPass').value;
            if(input === data.password) {
                document.getElementById('passArea').classList.add('hidden');
                document.getElementById('prevTitle').innerText = "Password Benar";
                setupTimerAndRedirect(data);
            } else {
                document.getElementById('passError').classList.remove('hidden');
            }
        };
    } else {
        // MODE NORMAL
        urlDisplay.innerText = targetUrl.length > 40 ? targetUrl.substring(0, 40) + "..." : targetUrl;
        setupTimerAndRedirect(data);
    }
}

function setupTimerAndRedirect(data) {
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
                btn.onclick = () => processRedirect(data);
            }
        }, 1000);
    } else {
        btn.disabled = false;
        btn.innerHTML = `Lanjut ke Tujuan <i class="fa-solid fa-arrow-right"></i>`;
        btn.onclick = () => processRedirect(data);
    }
}

async function processRedirect(data) {
    const btn = document.getElementById('btnContinue');
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Membuka...`;
    
    const updates = {};
    updates['clicks'] = increment(1);
    
    let finalUrl = "";
    if(Array.isArray(data.urls) && data.urls.length > 1) {
        finalUrl = data.urls[data.rotatorIndex];
        updates['rotatorIndex'] = (data.rotatorIndex + 1) % data.urls.length;
    } else {
        finalUrl = Array.isArray(data.urls) ? data.urls[0] : data.urls;
    }

    await update(ref(db, 'links/'+id), updates);
    if(data.selfDestruct) await remove(ref(db, 'links/'+id));

    if(data.cloaking) {
        document.body.innerHTML = `<style>body,html{margin:0;padding:0;height:100%;overflow:hidden;}</style>
        <iframe src="${finalUrl}" style="border:0;width:100%;height:100%;" allowfullscreen></iframe>`;
    } else {
        window.location.href = finalUrl;
    }
}

// --- ADMIN & FIREWALL ---
let taps=0;
window.unlockAdmin=()=>{ if(++taps>=5 && prompt("Admin:")==="RifqyQPP28!@") { renderAdmin(); taps=0; }};
window.switchTab = (tab) => {
    document.getElementById('tabLinks').className = tab==='links' ?
    "pb-3 border-b-2 border-blue-500 text-blue-400 font-bold text-sm uppercase tracking-wider transition-colors" : "pb-3 border-b-2 border-transparent text-slate-500 font-bold text-sm uppercase tracking-wider hover:text-slate-300 transition-colors";
    document.getElementById('tabFirewall').className = tab==='firewall' ?
    "pb-3 border-b-2 border-blue-500 text-blue-400 font-bold text-sm uppercase tracking-wider transition-colors" : "pb-3 border-b-2 border-transparent text-slate-500 font-bold text-sm uppercase tracking-wider hover:text-slate-300 transition-colors";
    if(tab==='links') renderAdminLinks(); else renderFirewall();
};

async function renderAdmin() {
    document.getElementById('adminPanel').classList.remove('hidden');
    renderAdminLinks();
}

async function renderAdminLinks() {
    document.getElementById('adminContent').innerHTML = `<div class="flex justify-center"><i class="fa-solid fa-spinner fa-spin text-2xl text-slate-400"></i></div>`;
    const snap = await get(ref(db, 'links'));
    let h = "";
    snap.forEach(c => {
        const d = c.val();
        let ipBtn = d.ip ? `<button onclick="banIP('${d.ip}')" class="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500 hover:text-white ml-2 font-bold uppercase">Ban IP</button>` : "";
        
        h += `<div class="bg-slate-800/40 p-4 mb-3 rounded-xl border border-slate-700/50 text-xs flex justify-between items-center hover:bg-slate-800/60 transition-colors">
            <div>
                <b class="text-blue-400 text-sm">${c.key}</b> <span class="text-slate-500 ml-2">(Creator: ${d.ip || '?'})</span><br>
                <span class="text-slate-300 mt-1 block truncate max-w-md">${d.urls}</span>
            </div>
            <div class="text-right flex items-center">
                <span class="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 font-mono mr-3">${d.clicks} Hits</span>
                <button onclick="del('${c.key}')" class="text-slate-500 hover:text-red-500 text-lg transition-colors"><i class="fa-solid fa-trash"></i></button>
                ${ipBtn}
            </div>
        </div>`;
    });
    document.getElementById('adminContent').innerHTML = h || `<p class="text-center text-slate-500 mt-10">Tidak ada link terdaftar.</p>`;
}

async function renderFirewall() {
    document.getElementById('adminContent').innerHTML = `<div class="flex justify-center"><i class="fa-solid fa-spinner fa-spin text-2xl text-slate-400"></i></div>`;
    const snap = await get(ref(db, 'firewall/banned_ips'));
    let h = "<p class='text-xs text-slate-400 mb-4 font-bold uppercase tracking-widest'>Daftar IP yang diblokir permanen:</p>";
    snap.forEach(c => {
        h += `<div class="bg-red-900/10 p-4 mb-3 rounded-xl border border-red-900/30 text-xs flex justify-between items-center">
            <div class="text-red-400 font-mono font-bold text-sm"><i class="fa-solid fa-shield-virus mr-2"></i> ${c.key}</div>
            <button onclick="unbanIP('${c.key}')" class="bg-green-500/20 text-green-400 px-3 py-1.5 rounded hover:bg-green-500 hover:text-white font-bold transition-colors">UNBAN</button>
        </div>`;
    });
    document.getElementById('adminContent').innerHTML = h || `<p class="text-center text-slate-500 mt-10">Firewall bersih. Tidak ada IP yang dibanned.</p>`;
}

window.banIP = async (ip) => {
    if(confirm("BAN IP "+ip+"? Orang ini tidak akan bisa buat/buka link lagi.")) {
        await set(ref(db, 'firewall/banned_ips/' + ip), { bannedAt: Date.now() });
        alert("IP Banned!");
        renderAdminLinks();
    }
};

window.unbanIP = async (ip) => {
    if(confirm("Buka blokir IP "+ip+"?")) {
        await remove(ref(db, 'firewall/banned_ips/' + ip));
        renderFirewall();
    }
};

// Standard Functions
window.del = async(k)=>{ if(confirm("Hapus link ini permanen?")) {await remove(ref(db,'links/'+k)); renderAdminLinks();} };

window.share = (p) => {
    const u = encodeURIComponent(window.location.href);
    const t = encodeURIComponent("Cek ini: ");
    if(p==='wa')window.open(`https://wa.me/?text=${t}${u}`); 
    if(p==='fb')window.open(`https://www.facebook.com/sharer.php?u=${u}`);
    if(p==='tw')window.open(`https://twitter.com/intent/tweet?url=${u}&text=${t}`); 
    if(p==='tg')window.open(`https://t.me/share/url?url=${u}&text=${t}`);
};

window.reportLink = async () => { if(confirm("Laporkan link ini sebagai spam/berbahaya?")) { await update(ref(db,'links/'+id),{isReported:true}); location.reload(); }};
function showError(t,m) { 
    document.getElementById('previewApp').classList.add('hidden'); 
    document.getElementById('errorApp').classList.remove('hidden'); 
    document.getElementById('errorTitle').innerText=t; 
    document.getElementById('errorDesc').innerText=m;
}
window.copyLink = () => { navigator.clipboard.writeText(document.getElementById('shortLink').innerText); alert("Link Berhasil Disalin!"); };
