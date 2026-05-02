const SUPABASE_URL = 'https://wyvliczohxpyptwxnvfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5';
const REDIRECT_URL = 'https://donutgames113.github.io/Curato/index.html';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let userKey = null;
let selectedCategory = "Other";
let currentImageData = null;

// Selectors
const authBtn = document.getElementById('auth-btn');
const keyMgr = document.getElementById('key-mgr');
const keyInput = document.getElementById('user-api-key');
const saveKeyBtn = document.getElementById('save-key-btn');
const catalogGrid = document.getElementById('catalog-grid');
const saveBtn = document.getElementById('save-btn');

// --- AUTH ---
supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        authBtn.innerText = "LOGOUT";
        keyMgr.classList.remove('hidden');
        // Check for existing key in 'user_settings' table
        const { data } = await supabase.from('user_settings').select('gemini_key').eq('id', session.user.id).maybeSingle();
        if (data) {
            userKey = data.gemini_key;
            keyInput.placeholder = "Key Active (••••)";
        }
        fetchItems();
    } else {
        authBtn.innerText = "CONNECT DISCORD";
        keyMgr.classList.add('hidden');
    }
});

authBtn.onclick = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) { await supabase.auth.signOut(); window.location.reload(); }
    else { await supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: REDIRECT_URL } }); }
};

saveKeyBtn.onclick = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const val = keyInput.value.trim();
    if (!val.startsWith("AIza")) return alert("Invalid Key");
    
    const { error } = await supabase.from('user_settings').upsert({ id: user.id, gemini_key: val });
    if (!error) { userKey = val; alert("Key Saved"); keyInput.value = ""; }
};

// --- CORE AI ---
async function askAI(base64, mime, prompt) {
    if (!userKey) return null;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${userKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    if (base64) payload.contents[0].parts.push({ inline_data: { mime_type: mime, data: base64 } });

    try {
        const resp = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
        const data = await resp.json();
        return data.candidates[0].content.parts[0].text;
    } catch (e) { return null; }
}

// --- APP LOGIC ---
document.getElementById('drop-zone').onclick = () => document.getElementById('file-input').click();
document.getElementById('file-input').onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        currentImageData = reader.result;
        document.getElementById('preview-img').src = reader.result;
        document.getElementById('preview-img').classList.remove('hidden');
        document.getElementById('drop-text').classList.add('hidden');
        
        if (userKey) {
            saveBtn.innerText = "SCANNING...";
            const b64 = reader.result.split(',')[1];
            const raw = await askAI(b64, file.type, "Return JSON ONLY: {\"name\":\"\",\"brand\":\"\",\"category\":\"Watch|Fragrance|Apparel|Other\"}");
            if (raw) {
                const clean = JSON.parse(raw.replace(/```json|```/g, ''));
                document.getElementById('item-name').value = clean.name;
                document.getElementById('item-brand').value = clean.brand;
                document.querySelector(`[data-val="${clean.category}"]`)?.click();
            }
            saveBtn.innerText = "Save to Archive";
        }
    };
};

saveBtn.onclick = async () => {
    const name = document.getElementById('item-name').value;
    if (!currentImageData || !name) return;
    await supabase.from('items').insert([{ name, image_url: currentImageData, tags: { brand: document.getElementById('item-brand').value, category: selectedCategory } }]);
    location.reload();
};

async function fetchItems() {
    const { data } = await supabase.from('items').select('*').order('id', { ascending: false });
    catalogGrid.innerHTML = data?.map(i => `
        <div class="item-card relative">
            <img src="${i.image_url}" class="aspect-[3/4] object-cover border border-neutral-900 mb-2">
            <p class="text-[9px] font-bold uppercase">${i.name}</p>
        </div>
    `).join('') || '';
}

document.querySelectorAll('.cat-opt').forEach(b => {
    b.onclick = () => {
        document.querySelectorAll('.cat-opt').forEach(x => x.classList.remove('bg-white', 'text-black'));
        b.classList.add('bg-white', 'text-black');
        selectedCategory = b.dataset.val;
    };
});