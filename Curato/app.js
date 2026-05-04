const SUPABASE_URL = 'https://wyvliczohxpyptwxnvfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5';
const REDIRECT_URL = 'https://donutgames113.github.io/Curato/index.html';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let selectedCategory = "Other";
let selectedSubCategory = null;
let currentImageData = null;
let currentSortClass = "ALL";

// RENDERER: Turns Gemini Markdown into the sophisticated UI
function renderAIResponse(text) {
    return text
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^\* \*\*(.*?)\*\*(.*$)/gim, '<li><strong>$1</strong>$2</li>')
        .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/\n/g, '<br>');
}

// GEMINI API INTEGRATION
async function callGeminiAPI(base64, mimeType, promptText) {
    const keyInput = document.getElementById('user-api-key');
    const modelSelect = document.getElementById('model-select');
    const { data: { session } } = await supabase.auth.getSession();
    
    const activeKey = keyInput?.value.trim() || session?.user?.user_metadata?.gemini_api_key;
    const activeModel = modelSelect?.value || session?.user?.user_metadata?.preferred_model || "gemini-1.5-flash";

    if (!activeKey) {
        alert("Please provide a Gemini API Key.");
        throw new Error("Missing API Key");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${activeKey}`;
    
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

    try {
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
    } catch (err) {
        console.error("Gemini failed:", err);
        throw err;
    }
}

// SORTING LOGIC
function sortItems(items) {
    if (currentSortClass === "ALL") return items;

    return items.filter(i => {
        if (currentSortClass === "TOPS") return i.tags?.subcategory === "Top";
        if (currentSortClass === "BOTTOMS") return i.tags?.subcategory === "Bottom";
        return i.tags?.category === currentSortClass;
    });
}

// FETCH AND RENDER GRID
async function fetchItems() {
    const { data, error } = await supabase.from('items').select('*').order('id', { ascending: false });
    if (error) return;
    
    const filtered = sortItems(data);

    const countEl = document.getElementById('item-count');
    if (countEl) countEl.innerText = filtered.length.toString().padStart(2, '0') + " ITEMS";

    const catalogGrid = document.getElementById('catalog-grid');
    if (catalogGrid) {
        catalogGrid.innerHTML = filtered.map(item => `
            <div class="item-card group">
                <div class="img-container">
                    <img src="${item.image_url}" loading="lazy">
                </div>
                <div class="mt-5">
                    <p class="text-[11px] font-medium uppercase tracking-widest text-white/90">${item.name}</p>
                    <p class="text-[9px] text-white/30 uppercase tracking-[0.15em] mt-1">
                        ${item.tags?.brand || 'Independent'} • ${item.tags?.subcategory || item.tags?.category}
                    </p>
                </div>
            </div>
        `).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authBtn = document.getElementById('auth-btn');
    const keyInput = document.getElementById('user-api-key');
    const modelSelect = document.getElementById('model-select');
    const dropZone = document.getElementById('drop-zone');
    const previewImg = document.getElementById('preview-img');
    const dropText = document.getElementById('drop-text');
    const nameInput = document.getElementById('item-name');
    const brandInput = document.getElementById('item-brand');
    const saveBtn = document.getElementById('save-btn');
    const askBtn = document.getElementById('ask-btn');
    const suggestionBox = document.getElementById('ai-suggestion');

    // AUTH HANDLING
    if (authBtn) {
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
    }

    // SETTINGS SYNC
    if (keyInput) {
        keyInput.onblur = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session && keyInput.value) {
                await supabase.auth.updateUser({
                    data: { gemini_api_key: keyInput.value.trim() }
                });
            }
        };
    }

    if (modelSelect) {
        modelSelect.onchange = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                await supabase.auth.updateUser({
                    data: { preferred_model: modelSelect.value }
                });
            }
        };
    }

    supabase.auth.onAuthStateChange((_, session) => {
        if (session) {
            if (authBtn) authBtn.innerText = `LOGOUT (${session.user.user_metadata.full_name || 'USER'})`;
            if (session.user.user_metadata.gemini_api_key && keyInput) {
                keyInput.value = session.user.user_metadata.gemini_api_key;
            }
            if (session.user.user_metadata.preferred_model && modelSelect) {
                modelSelect.value = session.user.user_metadata.preferred_model;
            }
            fetchItems();
        } else {
            if (authBtn) authBtn.innerText = "CONNECT";
        }
    });

    // CATEGORY BUTTONS
    const catButtons = document.querySelectorAll('.cat-opt');
    catButtons.forEach(btn => {
        btn.onclick = () => {
            catButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCategory = btn.dataset.val;
            selectedSubCategory = btn.dataset.sub || null;
        };
    });

    // SORT BUTTONS
    const sortButtons = document.querySelectorAll('.sort-opt');
    sortButtons.forEach(btn => {
        btn.onclick = () => {
            sortButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSortClass = btn.dataset.sort;
            fetchItems();
        };
    });

    // FILE INPUT HANDLING
    if (dropZone) dropZone.onclick = () => document.getElementById('file-input').click();
    
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                currentImageData = reader.result;
                if (previewImg) { previewImg.src = reader.result; previewImg.classList.remove('hidden'); }
                if (dropText) dropText.classList.add('hidden');
                if (saveBtn) { saveBtn.innerText = "IDENTIFYING..."; saveBtn.disabled = true; }

                try {
                    const base64 = reader.result.split(',')[1];
                    const prompt = "Identify this item. Return ONLY valid JSON: {\"name\":\"string\",\"brand\":\"string\",\"category\":\"Watch|Fragrance|Other\",\"subcategory\":\"Top|Bottom|null\"}";
                    const guess = await callGeminiAPI(base64, file.type, prompt);
                    if (guess) {
                        if (nameInput) nameInput.value = guess.name || "";
                        if (brandInput) brandInput.value = guess.brand || "";
                        const matchingBtn = Array.from(catButtons).find(b => b.dataset.val === guess.category && (b.dataset.sub || null) === (guess.subcategory || null));
                        if (matchingBtn) matchingBtn.click();
                    }
                } catch (err) {
                    console.error("Auto-ID error:", err);
                } finally {
                    if (saveBtn) { saveBtn.innerText = "ARCHIVE ITEM"; saveBtn.disabled = false; }
                }
            };
        };
    }

    // SAVE BUTTON LOGIC
    if (saveBtn) {
        saveBtn.onclick = async () => {
            if (!currentImageData || !nameInput?.value) {
                alert("Details required.");
                return;
            }

            saveBtn.innerText = "ARCHIVING...";
            const { error } = await supabase.from('items').insert([{
                name: nameInput.value,
                image_url: currentImageData,
                tags: { 
                    brand: brandInput?.value || "", 
                    category: selectedCategory,
                    subcategory: selectedSubCategory,
                    layerable: selectedSubCategory === "Top"
                }
            }]);

            if (!error) {
                location.reload();
            } else {
                alert("Archive failed: " + error.message);
                saveBtn.innerText = "ARCHIVE ITEM";
            }
        };
    }

    // CONSULT BUTTON LOGIC
    if (askBtn) {
        askBtn.onclick = async () => {
            const occasion = document.getElementById('occasion-input')?.value;
            const { data: items } = await supabase.from('items').select('*');
            
            if (!items?.length) return alert("Archive is empty.");
            if (!occasion) return alert("Please specify an occasion.");

            if (suggestionBox) {
                suggestionBox.classList.remove('hidden');
                suggestionBox.innerHTML = `<span class="animate-pulse">Curating Recommendation...</span>`;
            }

            const inventory = items.map(i => `${i.name} (${i.tags?.subcategory || i.tags?.category})`).join(', ');
            const prompt = `You are a high-end personal stylist. Given this inventory: [${inventory}], what should I wear for "${occasion}"? Provide one sophisticated recommendation. Use this exact format:
            ## [Recommendation Name]
            [Brief vision statement]
            
            ### THE ENSEMBLE
            * **[Item Name]** [Style tip]
            * **[Item Name]** [Style tip]
            
            ### THE SCENT
            **[Fragrance Name]** [Why it fits]
            
            > **STYLIST NOTE:** [Specific tip on fit or grooming]`;

            try {
                const advice = await callGeminiAPI(null, null, prompt);
                if (suggestionBox) {
                    suggestionBox.innerHTML = renderAIResponse(advice);
                }
            } catch (err) {
                if (suggestionBox) suggestionBox.innerText = "Stylist error: " + err.message;
            }
        };
    }
});