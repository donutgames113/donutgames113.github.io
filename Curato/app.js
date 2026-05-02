const SUPABASE_URL = 'https://wyvliczohxpyptwxnvfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5';
const GEMINI_KEY = 'AIzaSyBn7Quib6q9UaMm-Ro8Kmv0l825t8tn98k';
const REDIRECT_URL = 'https://donutgames113.github.io/Curato/index.html';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App State
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

// --- 1. Authentication ---
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
        catalogGrid.innerHTML = '<p class="text-neutral-400 text-[10px] uppercase tracking-widest">Connect to view your collection.</p>';
    }
});

// --- 2. Categories ---
document.querySelectorAll('.cat-opt').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.cat-opt').forEach(b => {
            b.classList.remove('bg-black', 'text-white', 'border-black');
            b.classList.add('border-neutral-200');
        });
        btn.classList.add('bg-black', 'text-white', 'border-black');
        selectedCategory = btn.dataset.val;
    };
});

// --- 3. Image Upload & Gemini ---
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
        
        saveBtn.innerText = "GEMINI IS SCANNING...";
        saveBtn.disabled = true;
        
        try {
            const base64 = reader.result.split(',')[1];
            const guess = await getGeminiGuess(base64, file.type);
            if (guess) {
                nameInput.value = guess.name || "";
                brandInput.value = guess.brand || "";
                const btn = Array.from(document.querySelectorAll('.cat-opt')).find(b => b.dataset.val === guess.category);
                if (btn) btn.click();
            }
        } catch (e) {
            console.warn("AI skipped. Manual entry active.");
        } finally {
            saveBtn.innerText = "SAVE TO ARCHIVE";
            saveBtn.disabled = false;
        }
    };
}

async function getGeminiGuess(base64, mimeType) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [
                { text: "Identify this item. Return ONLY JSON: { \"name\": \"string\", \"brand\": \"string\", \"category\": \"Watch|Fragrance|Apparel|Other\" }" },
                { inline_data: { mime_type: mimeType, data: base64 } }
            ] }]
        })
    });
    const res = await response.json();
    const text = res.candidates[0].content.parts[0].text;
    return JSON.parse(text.replace(/```json|```/g, ''));
}

// --- 4. Database Operations ---
saveBtn.onclick = async () => {
    if (!currentImageData || !nameInput.value) return alert("Please add an image and a name.");
    
    saveBtn.innerText = "SAVING...";
    const { error } = await supabase.from('items').insert([{
        name: nameInput.value,
        image_url: currentImageData,
        tags: { brand: brandInput.value, category: selectedCategory }
    }]);

    if (error) {
        console.error(error);
        alert("Save failed. Ensure your table 'items' exists.");
    } else {
        nameInput.value = ""; brandInput.value = "";
        previewImg.classList.add('hidden');
        dropText.classList.remove('hidden');
        fetchItems();
    }
    saveBtn.innerText = "SAVE TO ARCHIVE";
};

async function fetchItems(filter = "all") {
    const { data, error } = await supabase.from('items').select('*').order('id', { ascending: false });
    if (error) return;

    const filtered = filter === "all" ? data : data.filter(i => i.tags?.category === filter);
    
    catalogGrid.innerHTML = filtered.map(item => `
        <div class="item-card group relative">
            <button onclick="deleteItem(${item.id})" class="delete-btn">Delete</button>
            <div class="aspect-[3/4] bg-neutral-50 mb-3 overflow-hidden border border-neutral-100">
                <img src="${item.image_url}" class="w-full h-full object-cover">
            </div>
            <p class="text-[9px] font-bold uppercase tracking-widest">${item.name}</p>
            <p class="text-[8px] text-neutral-400 uppercase tracking-tighter">${item.tags?.brand || ''}</p>
        </div>
    `).join('');
}

// --- 5. Global Actions ---
window.deleteItem = async (id) => {
    if (!confirm("Remove this from your archive?")) return;
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) alert("Delete failed.");
    else fetchItems();
};

// Filter Buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('text-black'));
        btn.classList.add('text-black');
        fetchItems(btn.dataset.filter);
    };
});

// AI Consult
document.getElementById('ask-btn').onclick = async () => {
    const occasion = document.getElementById('occasion-input').value;
    if (!occasion) return;
    
    const { data: items } = await supabase.from('items').select('*');
    if (!items?.length) return alert("Archive some items first.");

    const sug = document.getElementById('ai-suggestion');
    sug.classList.remove('hidden');
    sug.innerText = "CONSULTING ARCHIVE...";

    const context = items.map(i => `${i.name} (${i.tags?.category})`).join(', ');
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            body: JSON.stringify({ contents: [{ parts: [{ text: `Out of [${context}], which is best for ${occasion}? Answer in 1 short sentence.` }] }] })
        });
        const json = await res.json();
        sug.innerText = json.candidates[0].content.parts[0].text;
    } catch (e) {
        sug.innerText = "Consultation unavailable.";
    }
};