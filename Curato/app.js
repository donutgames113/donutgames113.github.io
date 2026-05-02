const SUPABASE_URL = 'https://wyvliczohxpyptwxnvfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5';
const REDIRECT_URL = 'https://donutgames113.github.io/Curato/index.html';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let selectedCategory = "Other";
let currentImageData = null;

// DOM Elements
const authBtn = document.getElementById('auth-btn');
const keyInput = document.getElementById('user-api-key');
const dropZone = document.getElementById('drop-zone');
const previewImg = document.getElementById('preview-img');
const dropText = document.getElementById('drop-text');
const nameInput = document.getElementById('item-name');
const brandInput = document.getElementById('item-brand');
const saveBtn = document.getElementById('save-btn');
const catalogGrid = document.getElementById('catalog-grid');
const askBtn = document.getElementById('ask-btn');
const suggestionBox = document.getElementById('ai-suggestion');

// Auth Logic
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

// API Key Storage
keyInput.onblur = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && keyInput.value) {
        await supabase.auth.updateUser({
            data: { gemini_api_key: keyInput.value.trim() }
        });
    }
};

supabase.auth.onAuthStateChange((_, session) => {
    if (session) {
        authBtn.innerText = `SIGN OUT (${session.user.user_metadata.full_name || 'USER'})`;
        if (session.user.user_metadata.gemini_api_key) {
            keyInput.value = session.user.user_metadata.gemini_api_key;
        }
        fetchItems();
    } else {
        authBtn.innerText = "CONNECT DISCORD";
        catalogGrid.innerHTML = '<p class="text-neutral-400 text-[10px] uppercase">Login to view archive.</p>';
    }
});

// Category Selection
document.querySelectorAll('.cat-opt').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.cat-opt').forEach(b => b.classList.remove('bg-black', 'text-white'));
        btn.classList.add('bg-black', 'text-white');
        selectedCategory = btn.dataset.val;
    };
});

// Image Upload & Analysis
dropZone.onclick = () => document.getElementById('file-input').click();
document.getElementById('file-input').onchange = (e) => handleFile(e.target.files[0]);

async function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        currentImageData = reader.result;
        previewImg.src = reader.result;
        previewImg.classList.remove('hidden');
        dropText.classList.add('hidden');
        
        saveBtn.innerText = "SCANNING...";
        saveBtn.disabled = true;

        try {
            const base64 = reader.result.split(',')[1];
            const prompt = "Identify this item. Return ONLY valid JSON: {\"name\":\"string\",\"brand\":\"string\",\"category\":\"Watch|Fragrance|Apparel|Other\"}";
            const guess = await callGeminiAPI(base64, file.type, prompt);
            
            if (guess) {
                nameInput.value = guess.name || "";
                brandInput.value = guess.brand || "";
                const btn = Array.from(document.querySelectorAll('.cat-opt')).find(b => b.dataset.val === guess.category);
                if (btn) btn.click();
            }
        } catch (e) { 
            console.error("AI Analysis failed:", e); 
        } finally {
            saveBtn.innerText = "SAVE TO ARCHIVE";
            saveBtn.disabled = false;
        }
    };
}

// THE CRITICAL API CALL FIX
async function callGeminiAPI(base64, mimeType, promptText) {
    const { data: { session } } = await supabase.auth.getSession();
    const activeKey = keyInput.value.trim() || session?.user?.user_metadata?.gemini_api_key;

    if (!activeKey) {
        alert("Please paste your Gemini API Key in the top right box.");
        throw new Error("Missing API Key");
    }

    // UPDATED MODEL STRING FROM YOUR LISTMODELS OUTPUT[cite: 1]
    const model = "gemini-2.5-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;
    
    const body = {
        contents: [{
            parts: [{ text: promptText }]
        }]
    };

    if (base64) {
        body.contents[0].parts.push({
            inline_data: { mime_type: mimeType, data: base64 }
        });
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Google API Error");
    }
    
    const res = await response.json();
    const resultText = res.candidates[0].content.parts[0].text;
    
    if (promptText.includes("JSON")) {
        const cleanedText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    }
    return resultText;
}

// Database Persistence
saveBtn.onclick = async () => {
    if (!currentImageData || !nameInput.value) return alert("Upload an image and name it first.");
    saveBtn.innerText = "SAVING...";
    
    const { error } = await supabase.from('items').insert([{
        name: nameInput.value,
        image_url: currentImageData,
        tags: { brand: brandInput.value, category: selectedCategory }
    }]);

    if (!error) {
        nameInput.value = ""; brandInput.value = "";
        previewImg.classList.add('hidden'); dropText.classList.remove('hidden');
        fetchItems();
    } else {
        alert("Save failed: " + error.message);
    }
    saveBtn.innerText = "SAVE TO ARCHIVE";
};

async function fetchItems() {
    const { data, error } = await supabase.from('items').select('*').order('id', { ascending: false });
    if (error) return;
    
    catalogGrid.innerHTML = data.map(item => `
        <div class="item-card group">
            <button onclick="window.deleteItem(${item.id})" class="delete-btn">Delete</button>
            <div class="aspect-[3/4] bg-neutral-50 mb-3 border border-neutral-100 overflow-hidden">
                <img src="${item.image_url}" class="w-full h-full object-cover">
            </div>
            <p class="text-[9px] font-bold uppercase tracking-widest">${item.name}</p>
            <p class="text-[8px] text-neutral-400 uppercase tracking-tighter">${item.tags?.brand || ''}</p>
        </div>
    `).join('');
}

window.deleteItem = async (id) => {
    if (!confirm("Remove this item?")) return;
    await supabase.from('items').delete().eq(id);
    fetchItems();
};

// AI Suggestion Logic
askBtn.onclick = async () => {
    const occasion = document.getElementById('occasion-input').value;
    const { data: items } = await supabase.from('items').select('*');
    
    if (!items?.length) return alert("Your archive is empty.");
    if (!occasion) return alert("What's the occasion?");

    suggestionBox.classList.remove('hidden');
    suggestionBox.innerText = "CONSULTING ARCHIVE...";

    const inventory = items.map(i => `${i.name} (${i.tags?.category})`).join(', ');
    const prompt = `Based on this inventory: [${inventory}], what should I wear/use for "${occasion}"? One elegant sentence.`;

    try {
        const advice = await callGeminiAPI(null, null, prompt);
        suggestionBox.innerText = advice;
    } catch (e) {
        suggestionBox.innerText = "Consultation failed: " + e.message;
    }
};