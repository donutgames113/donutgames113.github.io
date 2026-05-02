const SUPABASE_URL = 'https://wyvliczohxpyptwxnvfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5';
const GEMINI_KEY = 'AIzaSyBn7Quib6q9UaMm-Ro8Kmv0l825t8tn98k';
const REDIRECT_URL = 'https://donutgames113.github.io/Curato/index.html';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Management
let selectedCategory = "Other";
let currentImageData = null;

// UI Selectors
const authBtn = document.getElementById('auth-btn');
const dropZone = document.getElementById('drop-zone');
const previewImg = document.getElementById('preview-img');
const dropText = document.getElementById('drop-text');
const nameInput = document.getElementById('item-name');
const brandInput = document.getElementById('item-brand');
const saveBtn = document.getElementById('save-btn');
const catalogGrid = document.getElementById('catalog-grid');
const askBtn = document.getElementById('ask-btn');
const suggestionBox = document.getElementById('ai-suggestion');

// --- 1. AUTHENTICATION ---
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

supabase.auth.onAuthStateChange((_, session) => {
    if (session) {
        authBtn.innerText = `SIGN OUT (${session.user.user_metadata.full_name || 'USER'})`;
        fetchItems();
    } else {
        authBtn.innerText = "CONNECT DISCORD";
        catalogGrid.innerHTML = '<p class="text-neutral-400 text-[10px] uppercase tracking-widest">Connect to view archive.</p>';
    }
});

// --- 2. CATEGORY SELECTION ---
document.querySelectorAll('.cat-opt').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.cat-opt').forEach(b => b.classList.remove('bg-black', 'text-white'));
        btn.classList.add('bg-black', 'text-white');
        selectedCategory = btn.dataset.val;
    };
});

// --- 3. THE REBUILT GEMINI CORE ---
async function callGeminiAPI(base64, mimeType, promptText) {
    // Explicitly using the v1beta endpoint as required for Project ID: gen-lang-client-0998346807
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    const payload = {
        contents: [{
            parts: [{ text: promptText }]
        }]
    };

    if (base64) {
        payload.contents[0].parts.push({
            inline_data: { mime_type: mimeType, data: base64 }
        });
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("CRITICAL GOOGLE API ERROR:", result);
            const errorReason = result.error?.message || "Check Project Permissions in AI Studio";
            throw new Error(`Google Error ${response.status}: ${errorReason}`);
        }
        
        const output = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!output) throw new Error("Empty response from AI");

        // Handle JSON parsing for Auto-Scan
        if (promptText.includes("JSON")) {
            const cleaned = output.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        }
        return output;

    } catch (err) {
        console.error("NETWORK OR API FAILURE:", err);
        throw err;
    }
}

// --- 4. IMAGE HANDLING ---
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
        
        saveBtn.innerText = "AI IDENTIFYING...";
        saveBtn.disabled = true;
        
        try {
            const base64 = reader.result.split(',')[1];
            const prompt = "Identify item. Return ONLY JSON: {\"name\":\"string\",\"brand\":\"string\",\"category\":\"Watch|Fragrance|Apparel|Other\"}";
            const guess = await callGeminiAPI(base64, file.type, prompt);
            
            if (guess) {
                nameInput.value = guess.name || "";
                brandInput.value = guess.brand || "";
                const btn = Array.from(document.querySelectorAll('.cat-opt')).find(b => b.dataset.val === guess.category);
                if (btn) btn.click();
            }
        } catch (e) {
            console.warn("Auto-scan failed, manual entry allowed.");
        } finally {
            saveBtn.innerText = "SAVE TO ARCHIVE";
            saveBtn.disabled = false;
        }
    };
}

// --- 5. DATABASE OPERATIONS ---
saveBtn.onclick = async () => {
    if (!currentImageData || !nameInput.value) return alert("Missing image or item name.");
    saveBtn.innerText = "SAVING...";
    
    const { error } = await supabase.from('items').insert([{
        name: nameInput.value,
        image_url: currentImageData,
        tags: { brand: brandInput.value, category: selectedCategory }
    }]);

    if (!error) {
        nameInput.value = ""; 
        brandInput.value = "";
        previewImg.classList.add('hidden'); 
        dropText.classList.remove('hidden');
        fetchItems();
    }
    saveBtn.innerText = "SAVE TO ARCHIVE";
};

async function fetchItems() {
    const { data, error } = await supabase.from('items').select('*').order('id', { ascending: false });
    if (error) return;
    
    catalogGrid.innerHTML = data.map(item => `
        <div class="item-card relative group">
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
    if (!confirm("Remove from archive?")) return;
    await supabase.from('items').delete().eq('id', id);
    fetchItems();
};

// --- 6. CONSULTATION ---
askBtn.onclick = async () => {
    const occasion = document.getElementById('occasion-input').value;
    const { data: items } = await supabase.from('items').select('*');
    
    if (!items?.length || !occasion) return alert("Archive some items and enter an occasion.");

    suggestionBox.classList.remove('hidden');
    suggestionBox.innerText = "CURATING SELECTION...";

    const context = items.map(i => `${i.name} (${i.tags?.category || 'Item'})`).join(', ');
    const prompt = `Stylist persona. Archive: [${context}]. Recommend ONE item for "${occasion}". One short sentence.`;

    try {
        const advice = await callGeminiAPI(null, null, prompt);
        suggestionBox.innerText = advice;
    } catch (e) {
        suggestionBox.innerText = "Consultation unavailable. Check browser console for Google API error.";
    }
};
