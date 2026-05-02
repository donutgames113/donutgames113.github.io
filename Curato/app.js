// --- CONFIGURATION ---
const SUPABASE_URL = 'https://wyvliczohxpyptwxnvfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5';
const GEMINI_KEY = 'AIzaSyBn7Quib6q9UaMm-Ro8Kmv0l825t8tn98k';
const REDIRECT_URL = 'https://donutgames113.github.io/Curato/index.html';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- STATE MANAGEMENT ---
let selectedCategory = "Other";
let currentImageData = null;

// --- DOM ELEMENTS ---
const authBtn = document.getElementById('auth-btn');
const dropZone = document.getElementById('drop-zone');
const previewImg = document.getElementById('preview-img');
const dropText = document.getElementById('drop-text');
const nameInput = document.getElementById('item-name');
const brandInput = document.getElementById('item-brand');
const saveBtn = document.getElementById('save-btn');
const catalogGrid = document.getElementById('catalog-grid');
const aiSuggestion = document.getElementById('ai-suggestion');

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

// Check session on load
supabase.auth.onAuthStateChange((_, session) => {
    if (session) {
        authBtn.innerText = `DISCONNECT (${session.user.user_metadata.full_name || 'USER'})`;
        fetchItems();
    } else {
        authBtn.innerText = "CONNECT DISCORD";
        catalogGrid.innerHTML = '<p class="text-neutral-400 text-[10px] uppercase tracking-widest">Login to view archive</p>';
    }
});

// --- UI LOGIC (CATEGORIES) ---
document.querySelectorAll('.cat-opt').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.cat-opt').forEach(b => b.classList.remove('bg-black', 'text-white'));
        btn.classList.add('bg-black', 'text-white');
        selectedCategory = btn.dataset.val;
    };
});

// --- IMAGE UPLOAD & PREVIEW ---
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
        
        // Start Gemini identification
        saveBtn.innerText = "IDENTIFYING...";
        saveBtn.disabled = true;
        
        try {
            const base64 = reader.result.split(',')[1];
            const guess = await getGeminiGuess(base64, file.type);
            
            if (guess) {
                nameInput.value = guess.name || "";
                brandInput.value = guess.brand || "";
                const catBtn = Array.from(document.querySelectorAll('.cat-opt')).find(b => b.dataset.val === guess.category);
                if (catBtn) catBtn.click();
            }
        } catch (err) {
            console.error("Gemini Error:", err);
            // Don't alert user; just let them type manually if AI fails
        } finally {
            saveBtn.innerText = "SAVE TO ARCHIVE";
            saveBtn.disabled = false;
        }
    };
}

// --- GEMINI API CALL ---
async function getGeminiGuess(base64, mimeType) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Identify this item. Return ONLY JSON: { \"name\": \"string\", \"brand\": \"string\", \"category\": \"Watch|Fragrance|Apparel|Other\", \"vibe\": \"1 sentence\" }" },
                        { inline_data: { mime_type: mimeType, data: base64 } }
                    ]
                }]
            })
        });

        const res = await response.json();

        if (!response.ok) {
            console.error("Gemini API Error Response:", res);
            throw new Error(res.error?.message || "API Error");
        }

        if (!res.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error("Gemini returned empty content");
        }

        const cleanText = res.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Gemini Failure Details:", e);
        // Important: Return a default object so the app doesn't crash
        return { name: "Unknown Item", brand: "Unknown Brand", category: "Other" };
    }
}

// --- DATABASE OPERATIONS ---
saveBtn.onclick = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert("Login required to save.");
    if (!currentImageData || !nameInput.value) return alert("Image and name required.");

    saveBtn.innerText = "SAVING...";
    
    const { error } = await supabase.from('items').insert([{
        name: nameInput.value,
        image_url: currentImageData,
        tags: { 
            brand: brandInput.value, 
            category: selectedCategory, 
            vibe: `A ${selectedCategory} by ${brandInput.value}` 
        }
    }]);

    if (error) {
        console.error("Supabase Error:", error);
        alert("Error saving. Check console.");
    } else {
        // Reset Form
        nameInput.value = ""; brandInput.value = "";
        previewImg.classList.add('hidden'); dropText.classList.remove('hidden');
        currentImageData = null;
        fetchItems();
    }
    saveBtn.innerText = "SAVE TO ARCHIVE";
};

async function fetchItems(filter = "all") {
    let { data, error } = await supabase.from('items').select('*').order('id', { ascending: false });
    if (error) return console.error(error);
    
    const filteredData = filter === "all" ? data : data.filter(i => i.tags?.category === filter);
    
    catalogGrid.innerHTML = filteredData.map(item => `
        <div class="item-card group">
            <div class="aspect-[3/4] bg-neutral-50 mb-3 overflow-hidden border border-neutral-100">
                <img src="${item.image_url}" class="w-full h-full object-cover">
            </div>
            <p class="text-[9px] font-bold uppercase tracking-widest">${item.name}</p>
            <p class="text-[8px] text-neutral-400 uppercase tracking-tighter">${item.tags?.brand || ''}</p>
        </div>
    `).join('');
}

// --- FILTERS & AI RECOMMENDATION ---
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('text-black'));
        btn.classList.add('text-black');
        fetchItems(btn.dataset.filter);
    };
});

document.getElementById('ask-btn').onclick = async () => {
    const occasion = document.getElementById('occasion-input').value;
    if (!occasion) return;

    const { data: items } = await supabase.from('items').select('*');
    if (!items?.length) return alert("Archive some items first.");

    aiSuggestion.classList.remove('hidden');
    aiSuggestion.innerText = "CONSULTING ARCHIVE...";

    const itemContext = items.map(i => `${i.name} (${i.tags?.category || 'Item'})`).join(', ');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `From this list: [${itemContext}], which is best for "${occasion}"? Answer in one short, elegant sentence.` }] }]
            })
        });
        const res = await response.json();
        aiSuggestion.innerText = res.candidates[0].content.parts[0].text;
    } catch (e) {
        aiSuggestion.innerText = "AI consultation failed.";
    }
};