const SUPABASE_URL = 'https://wyvliczohxpyptwxnvfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5';
const GEMINI_KEY = 'AIzaSyBn7Quib6q9UaMm-Ro8Kmv0l825t8tn98k';
const REDIRECT_URL = 'https://donutgames113.github.io/Curato/index.html';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let selectedCategory = "Other";
let currentImageData = null;

// Selectors
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

// --- AUTHENTICATION ---
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
        catalogGrid.innerHTML = '<p class="text-neutral-400 text-[10px] uppercase">Login to view archive.</p>';
    }
});

// --- CATEGORY SELECTION ---
document.querySelectorAll('.cat-opt').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.cat-opt').forEach(b => b.classList.remove('bg-black', 'text-white'));
        btn.classList.add('bg-black', 'text-white');
        selectedCategory = btn.dataset.val;
    };
});

// --- IMAGE UPLOAD & AUTO-SCAN ---
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
            const guess = await callGeminiAPI(base64, file.type, "Identify item. Return ONLY JSON: {\"name\":\"string\",\"brand\":\"string\",\"category\":\"Watch|Fragrance|Apparel|Other\"}");
            if (guess) {
                nameInput.value = guess.name || "";
                brandInput.value = guess.brand || "";
                const btn = Array.from(document.querySelectorAll('.cat-opt')).find(b => b.dataset.val === guess.category);
                if (btn) btn.click();
            }
        } catch (e) { console.error("Scan error", e); }
        
        saveBtn.innerText = "SAVE TO ARCHIVE";
        saveBtn.disabled = false;
    };
}

// --- SHARED GEMINI FETCH FUNCTION ---
async function callGeminiAPI(base64, mimeType, promptText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    const body = {
        contents: [{
            parts: [{ text: promptText }]
        }]
    };

    // Add image data if provided (for scanning)
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

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const res = await response.json();
    const resultText = res.candidates[0].content.parts[0].text;
    
    // If we expect JSON (for scanning), parse it. Otherwise return raw text (for consultation).
    if (promptText.includes("JSON")) {
        return JSON.parse(resultText.replace(/```json|```/g, '').trim());
    }
    return resultText;
}

// --- DATABASE SAVING ---
saveBtn.onclick = async () => {
    if (!currentImageData || !nameInput.value) return alert("Missing image or name.");
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
    }
    saveBtn.innerText = "SAVE TO ARCHIVE";
};

// --- FETCH & DELETE ---
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
    if (!confirm("Delete?")) return;
    await supabase.from('items').delete().eq('id', id);
    fetchItems();
};

// --- CONSULTATION FEATURE ---
askBtn.onclick = async () => {
    const occasion = document.getElementById('occasion-input').value;
    const { data: items } = await supabase.from('items').select('*');
    
    if (!items?.length || !occasion) {
        alert("Please add items to your archive and enter an occasion.");
        return;
    }

    suggestionBox.classList.remove('hidden');
    suggestionBox.innerText = "CURATING YOUR SELECTION...";

    const inventory = items.map(i => `${i.name} (${i.tags?.category})`).join(', ');
    const prompt = `I have these items in my archive: [${inventory}]. Based on these, what should I wear or use for "${occasion}"? Provide one specific, stylish recommendation in a short sentence.`;

    try {
        const advice = await callGeminiAPI(null, null, prompt);
        suggestionBox.innerText = advice;
    } catch (e) {
        console.error(e);
        suggestionBox.innerText = "Consultation unavailable. Check console for 404/API errors.";
    }
};