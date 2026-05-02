// CONFIGURATION
const SUPABASE_URL = 'https://wyvliczohxpyptwxnvfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5';
const REDIRECT_URL = 'https://donutgames113.github.io/Curato/index.html';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// STATE
let userKey = null;
let selectedCategory = "Other";
let currentImageData = null;

// UI ELEMENTS
const authBtn = document.getElementById('auth-btn');
const keySection = document.getElementById('key-section');
const keyInput = document.getElementById('user-api-key');
const saveKeyBtn = document.getElementById('save-key-btn');
const catalogGrid = document.getElementById('catalog-grid');
const askBtn = document.getElementById('ask-btn');
const suggestionBox = document.getElementById('ai-suggestion');
const previewImg = document.getElementById('preview-img');
const dropText = document.getElementById('drop-text');
const nameInput = document.getElementById('item-name');
const brandInput = document.getElementById('item-brand');
const saveBtn = document.getElementById('save-btn');

// --- 1. SESSION MANAGEMENT ---
supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        authBtn.innerText = "SIGN OUT";
        keySection.classList.remove('hidden');
        await fetchUserKey(session.user.id);
        fetchItems();
    } else {
        authBtn.innerText = "CONNECT DISCORD";
        keySection.classList.add('hidden');
        catalogGrid.innerHTML = '<p class="text-[10px] uppercase text-neutral-700">Connect account to view archive.</p>';
    }
});

authBtn.onclick = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        await supabase.auth.signOut();
        window.location.reload();
    } else {
        await supabase.auth.signInWithOAuth({ 
            provider: 'discord', 
            options: { redirectTo: REDIRECT_URL } 
        });
    }
};

async function fetchUserKey(userId) {
    const { data, error } = await supabase
        .from('user_settings')
        .select('gemini_key')
        .eq('id', userId)
        .maybeSingle();
    
    if (data?.gemini_key) {
        userKey = data.gemini_key;
        keyInput.placeholder = "API Key Active ••••••••";
    }
}

saveKeyBtn.onclick = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const newKey = keyInput.value.trim();
    
    if (!newKey.startsWith("AIza")) return alert("Invalid format. Key usually starts with AIza...");

    const { error } = await supabase
        .from('user_settings')
        .upsert({ id: user.id, gemini_key: newKey });

    if (!error) {
        userKey = newKey;
        keyInput.value = "";
        alert("Settings Updated.");
    }
};

// --- 2. AI LOGIC (GEMINI) ---
async function callGemini(base64, mimeType, prompt) {
    if (!userKey) {
        alert("Please provide your Gemini API key in settings first.");
        return null;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${userKey}`;
    const body = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    if (base64) {
        body.contents[0].parts.push({
            inline_data: { mime_type: mimeType, data: base64 }
        });
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        const result = data.candidates[0].content.parts[0].text;

        if (prompt.includes("JSON")) {
            return JSON.parse(result.replace(/```json|```/g, '').trim());
        }
        return result;
    } catch (e) {
        console.error("AI Error:", e);
        return null;
    }
}

// --- 3. ARCHIVE ACTIONS ---
document.getElementById('drop-zone').onclick = () => document.getElementById('file-input').click();
document.getElementById('file-input').onchange = (e) => handleUpload(e.target.files[0]);

async function handleUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        currentImageData = reader.result;
        previewImg.src = reader.result;
        previewImg.classList.remove('hidden');
        dropText.classList.add('hidden');
        
        if (userKey) {
            saveBtn.innerText = "SCANNING...";
            const b64 = reader.result.split(',')[1];
            const info = await callGemini(b64, file.type, "Analyze image. Return ONLY JSON: {\"name\":\"\",\"brand\":\"\",\"category\":\"Watch|Fragrance|Apparel|Other\"}");
            if (info) {
                nameInput.value = info.name || "";
                brandInput.value = info.brand || "";
                document.querySelector(`[data-val="${info.category}"]`)?.click();
            }
            saveBtn.innerText = "ADD TO ARCHIVE";
        }
    };
}

saveBtn.onclick = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !currentImageData || !nameInput.value) return alert("Missing info.");

    saveBtn.innerText = "SAVING...";
    await supabase.from('items').insert([{
        user_id: user.id,
        name: nameInput.value,
        image_url: currentImageData,
        tags: { brand: brandInput.value, category: selectedCategory }
    }]);

    nameInput.value = ""; brandInput.value = "";
    previewImg.classList.add('hidden'); dropText.classList.remove('hidden');
    saveBtn.innerText = "ADD TO ARCHIVE";
    fetchItems();
};

async function fetchItems() {
    const { data } = await supabase.from('items').select('*').order('id', { ascending: false });
    if (!data) return;
    catalogGrid.innerHTML = data.map(i => `
        <div class="item-card relative group animate-fade-in">
            <button onclick="deleteItem(${i.id})" class="delete-btn">Remove</button>
            <div class="aspect-[3/4] bg-neutral-900 border border-neutral-800 overflow-hidden mb-3">
                <img src="${i.image_url}" class="w-full h-full object-cover grayscale hover:grayscale-0 transition duration-500">
            </div>
            <p class="text-[9px] font-bold uppercase tracking-widest">${i.name}</p>
            <p class="text-[8px] text-neutral-500 uppercase tracking-tighter">${i.tags?.brand || 'Unknown'}</p>
        </div>
    `).join('');
}

window.deleteItem = async (id) => {
    if (confirm("Remove from archive?")) {
        await supabase.from('items').delete().eq('id', id);
        fetchItems();
    }
};

askBtn.onclick = async () => {
    const occasion = document.getElementById('occasion-input').value;
    const { data: items } = await supabase.from('items').select('name');
    if (!items?.length || !occasion) return alert("Archive is empty or occasion missing.");

    suggestionBox.classList.remove('hidden');
    suggestionBox.innerText = "CONSULTING...";
    
    const names = items.map(i => i.name).join(', ');
    const advice = await callGemini(null, null, `I have: [${names}]. What should I wear for ${occasion}? One short, elegant sentence.`);
    suggestionBox.innerText = advice || "Unable to consult at this time.";
};

document.querySelectorAll('.cat-opt').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.cat-opt').forEach(b => b.classList.remove('bg-white', 'text-black'));
        btn.classList.add('bg-white', 'text-black');
        selectedCategory = btn.dataset.val;
    };
});