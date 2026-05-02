const SUPABASE_URL = 'https://wyvliczohxpyptwxnvfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5';
const GEMINI_KEY = 'AIzaSyBn7Quib6q9UaMm-Ro8Kmv0l825t8tn98k';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const authBtn = document.getElementById('auth-btn');
const catalogGrid = document.getElementById('catalog-grid');
const aiSuggestion = document.getElementById('ai-suggestion');

// --- 1. Authentication ---
async function handleAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        await supabase.auth.signOut();
        window.location.href = "https://donutgames113.github.io/Curato/index.html"; 
    } else {
        await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: { 
                // Ensure this is exactly your GitHub Pages URL
                redirectTo: "https://donutgames113.github.io/Curato/index.html" 
            }
        });
    }
}

authBtn.onclick = handleAuth;

supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        authBtn.innerText = "DISCONNECT";
        fetchItems();
    } else {
        authBtn.innerText = "CONNECT DISCORD";
        catalogGrid.innerHTML = '<p class="text-neutral-400 text-xs">Connect Discord to view your archive.</p>';
    }
});

// --- 2. Image Processing & Gemini ---
dropZone.onclick = () => fileInput.click();
fileInput.onchange = (e) => processFile(e.target.files[0]);

async function processFile(file) {
    if (!file) return;
    dropZone.innerHTML = '<p class="text-xs uppercase animate-pulse">Analyzing with Gemini...</p>';

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        
        try {
            const aiData = await getGeminiTags(base64, file.type);
            const { error } = await supabase.from('items').insert([{
                image_url: reader.result,
                tags: aiData,
                name: aiData.name || "Untitled Item"
            }]);
            
            if (error) throw error;
            fetchItems();
        } catch (err) {
            console.error(err);
            alert("Archive failed. Check console.");
        } finally {
            dropZone.innerHTML = '<p class="text-xs uppercase tracking-widest text-neutral-400">Drag to Archive +</p>';
        }
    };
}

async function getGeminiTags(base64, mimeType) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: "Identify this item (fragrance, watch, or luxury good). Provide JSON: { 'name': 'string', 'brand': 'string', 'tags': ['array of 4 moods/occasions'], 'vibe': 'short description' }" },
                    { inline_data: { mime_type: mimeType, data: base64 } }
                ]
            }]
        })
    });
    const res = await response.json();
    const cleanText = res.candidates[0].content.parts[0].text.replace(/```json|```/g, '');
    return JSON.parse(cleanText);
}

// --- 3. UI Display ---
async function fetchItems() {
    const { data } = await supabase.from('items').select('*').order('id', { ascending: false });
    catalogGrid.innerHTML = data.map(item => `
        <div class="item-card group">
            <div class="aspect-[3/4] overflow-hidden bg-neutral-50 mb-4">
                <img src="${item.image_url}" class="w-full h-full object-cover">
            </div>
            <h3 class="text-xs font-bold uppercase tracking-widest">${item.name}</h3>
            <p class="text-[10px] text-neutral-400 uppercase mt-1">${item.tags.brand}</p>
        </div>
    `).join('');
}

// --- 4. The Recommendation Logic ---
document.getElementById('ask-btn').onclick = async () => {
    const occasion = document.getElementById('occasion-input').value;
    const { data: items } = await supabase.from('items').select('*');
    
    if (!items || items.length === 0) return alert("Archive some items first.");

    aiSuggestion.classList.remove('hidden');
    aiSuggestion.innerText = "Thinking...";

    const itemContext = items.map(i => `${i.name} (${i.tags.vibe})`).join(', ');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            contents: [{
                parts: [{ text: `Out of these items: [${itemContext}], which is best for: "${occasion}"? Explain briefly why in 1 sentence.` }]
            }]
        })
    });
    
    const res = await response.json();
    aiSuggestion.innerText = res.candidates[0].content.parts[0].text;
};