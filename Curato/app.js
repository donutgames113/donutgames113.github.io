const SUPABASE_URL = 'https://wyvliczohxpyptwxnvfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5';
const REDIRECT_URL = 'https://donutgames113.github.io/Curato/index.html';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let selectedCategory = "Other";
let currentImageData = null;
let editingItemId = null; // Track which item is being edited

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

// --- AUTHENTICATION ---[cite: 1]

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
        authBtn.innerText = `LOGOUT (${session.user.user_metadata.full_name || 'USER'})`;
        if (session.user.user_metadata.gemini_api_key) {
            keyInput.value = session.user.user_metadata.gemini_api_key;
        }
        fetchItems();
    } else {
        authBtn.innerText = "CONNECT";
        catalogGrid.innerHTML = '<p class="text-neutral-400 text-[10px] uppercase tracking-widest col-span-full text-center py-20">Archive Locked. Please Connect.</p>';
    }
});

// --- CATEGORY SELECTION ---[cite: 1]

document.querySelectorAll('.cat-opt').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.cat-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCategory = btn.dataset.val;
    };
});

// --- IMAGE HANDLING & SCAN ---[cite: 1]

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
        saveBtn.innerText = "IDENTIFYING...";
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
        } catch (e) { console.error("AI Scan failed:", e); } 
        finally { saveBtn.innerText = "ARCHIVE ITEM"; saveBtn.disabled = false; }
    };
}

// --- GEMINI API INTEGRATION ---[cite: 1]

async function callGeminiAPI(base64, mimeType, promptText) {
    const { data: { session } } = await supabase.auth.getSession();
    const activeKey = keyInput.value.trim() || session?.user?.user_metadata?.gemini_api_key;
    if (!activeKey) { alert("Please provide a Gemini API Key."); throw new Error("Missing API Key"); }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
    const body = { contents: [{ parts: [{ text: promptText }] }] };
    if (base64) body.contents[0].parts.push({ inline_data: { mime_type: mimeType, data: base64 } });

    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const res = await response.json();
    const resultText = res.candidates[0].content.parts[0].text;
    
    if (promptText.includes("JSON")) {
        const cleanedText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    }
    return resultText;
}

// --- DATABASE OPERATIONS ---[cite: 1]

saveBtn.onclick = async () => {
    if (!currentImageData || !nameInput.value) return alert("Details required.");
    saveBtn.innerText = "ARCHIVING...";
    const { error } = await supabase.from('items').insert([{
        name: nameInput.value,
        image_url: currentImageData,
        tags: { brand: brandInput.value, category: selectedCategory, style: [] }
    }]);
    if (!error) { location.reload(); } else { alert("Archive failed: " + error.message); }
};

async function fetchItems() {
    const { data, error } = await supabase.from('items').select('*').order('id', { ascending: false });
    if (error) return;
    if (document.getElementById('item-count')) document.getElementById('item-count').innerText = data.length.toString().padStart(2, '0') + " ITEMS";

    catalogGrid.innerHTML = data.map(item => `
        <div class="item-card group">
            <button onclick="openEdit(${item.id})" class="action-btn edit-trigger">Edit</button>
            <button onclick="window.deleteItem(${item.id})" class="action-btn delete-trigger">Remove</button>
            <div class="img-container">
                <img src="${item.image_url}" loading="lazy">
            </div>
            <div class="mt-5">
                <p class="text-[11px] font-medium uppercase tracking-widest text-white/90">${item.name}</p>
                <p class="text-[9px] text-white/30 uppercase tracking-[0.15em] mt-1">${item.tags?.brand || 'Independent'}</p>
                <div class="flex flex-wrap gap-1 mt-3">
                    ${(item.tags?.style || []).map(t => `<span class="tag-pill">${t}</span>`).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

// --- EDITING SYSTEM ---[cite: 1]

window.openEdit = async (id) => {
    editingItemId = id;
    const { data: item } = await supabase.from('items').select('*').eq('id', id).single();
    
    document.querySelectorAll('.prefab-tag').forEach(btn => btn.classList.remove('active'));
    document.getElementById('custom-tags').value = "";

    const styles = item.tags?.style || [];
    document.querySelectorAll('.prefab-tag').forEach(btn => {
        if (styles.includes(btn.innerText.toLowerCase())) btn.classList.add('active');
    });
    
    const custom = styles.filter(s => !['formal', 'casual', 'streetwear', 'minimalist'].includes(s));
    document.getElementById('custom-tags').value = custom.join(', ');
    
    document.getElementById('edit-modal').style.display = 'flex';
};

window.toggleTag = (btn) => btn.classList.toggle('active');
window.closeEdit = () => { document.getElementById('edit-modal').style.display = 'none'; };

document.getElementById('update-btn').onclick = async () => {
    const prefabs = Array.from(document.querySelectorAll('.prefab-tag.active')).map(b => b.innerText.toLowerCase());
    const customs = document.getElementById('custom-tags').value.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    const allTags = [...new Set([...prefabs, ...customs])];
    
    const { data: item } = await supabase.from('items').select('tags').eq('id', editingItemId).single();
    await supabase.from('items').update({
        tags: { ...item.tags, style: allTags }
    }).eq('id', editingItemId);
    
    closeEdit();
    fetchItems();
};

window.deleteItem = async (id) => {
    if (!confirm("Permanently remove this item from your collection?")) return;
    await supabase.from('items').delete().eq('id', id);
    fetchItems();
};

// --- CONSULTATION LOGIC ---[cite: 1]

askBtn.onclick = async () => {
    const occasion = document.getElementById('occasion-input').value;
    const { data: items } = await supabase.from('items').select('*');
    if (!items?.length || !occasion) return alert("Archive is empty or occasion unspecified.");

    suggestionBox.classList.remove('hidden');
    suggestionBox.innerHTML = `<span class="animate-pulse">Analyzing vibes for ${occasion}...</span>`;

    const inventory = items.map(i => {
        const styleInfo = i.tags?.style?.length ? ` [Style Vibes: ${i.tags.style.join(', ')}]` : '';
        return `${i.name} by ${i.tags?.brand || 'Unknown'} (${i.tags?.category})${styleInfo}`;
    }).join('; ');

    const prompt = `You are a professional personal stylist. Given this inventory: [${inventory}], what should I wear for "${occasion}"? 
    Strictly prioritize items whose "Style Vibes" match the context of the occasion.
    Provide one sophisticated, concise recommendation.`;

    try {
        const advice = await callGeminiAPI(null, null, prompt);
        suggestionBox.innerText = advice;
    } catch (e) { suggestionBox.innerText = "Stylist error: " + e.message; }
};