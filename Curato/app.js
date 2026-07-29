const SUPABASE_URL = 'https://wyvliczohxpyptwxnvfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5';
const REDIRECT_URL = 'https://donutgames113.github.io/Curato/index.html';

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let selectedCategory = "Other";
let selectedSubCategory = null;
let currentImageData = null;
let currentSortClass = "ALL";

// ========================================
// AI RESPONSE RENDERER
// ========================================

function renderAIResponse(text) {

    // Clean markdown artifacts
    text = text
        .replace(/```markdown/g, '')
        .replace(/```/g, '')
        .trim();

    // Split into sections
    const lines = text.split('\n');

    let html = '';
    let inList = false;

    lines.forEach(line => {

        line = line.trim();

        // Empty line
        if (!line) {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            return;
        }

        // H2
        if (line.startsWith('## ')) {

            if (inList) {
                html += '</ul>';
                inList = false;
            }

            html += `
                <h2 class="text-3xl font-extralight text-[#d4ff6a] mb-6 mt-2 tracking-tight">
                    ${line.replace('## ', '')}
                </h2>
            `;

            return;
        }

        // H3
        if (line.startsWith('### ')) {

            if (inList) {
                html += '</ul>';
                inList = false;
            }

            html += `
                <h3 class="text-[10px] uppercase tracking-[0.3em] text-white/40 mt-10 mb-4">
                    ${line.replace('### ', '')}
                </h3>
            `;

            return;
        }

        // Bullet points
        if (
            line.startsWith('- ') ||
            line.startsWith('* ')
        ) {

            if (!inList) {
                html += `<ul class="space-y-4 mt-4">`;
                inList = true;
            }

            const clean = line
            .replace(/^[-*]\s/, '')
            .replace(
                /\*\*(.*?)\*\*/g,
                '<strong class="text-white font-medium">$1</strong>'
            );

            html += `
                <li class="flex gap-4 items-start">
                    <div class="w-1.5 h-1.5 rounded-full bg-[#d4ff6a] mt-2 shrink-0"></div>
                    <div class="text-sm leading-relaxed text-white/70">
                        ${clean}
                    </div>
                </li>
            `;

            return;
        }

        // Quote block
        if (line.startsWith('> ')) {

            if (inList) {
                html += '</ul>';
                inList = false;
            }

            html += `
                <blockquote class="border-l border-[#d4ff6a]/50 pl-6 py-2 mt-8 text-white/50 italic text-sm leading-relaxed">
                    ${line.replace('> ', '')}
                </blockquote>
            `;

            return;
        }

        // Regular paragraph
        if (inList) {
            html += '</ul>';
            inList = false;
        }

        html += `
            <p class="text-[15px] leading-8 text-white/75 mb-6 font-light">
                ${line.replace(
                    /\*\*(.*?)\*\*/g,
                    '<strong class="text-white font-medium">$1</strong>'
                )}
            </p>
        `;
    });

    if (inList) {
        html += '</ul>';
    }

    return html;
}

// ========================================
// GEMINI
// ========================================

async function callGeminiAPI(base64, mimeType, promptText) {

    const keyInput =
        document.getElementById('user-api-key');

    const modelSelect =
        document.getElementById('model-select');

    const { data: { session } } =
        await supabase.auth.getSession();

    const activeKey =
        keyInput?.value.trim() ||
        session?.user?.user_metadata?.gemini_api_key;

    const activeModel =
        modelSelect?.value ||
        session?.user?.user_metadata?.preferred_model ||
        "gemini-2.0-flash";

    if (!activeKey) {

        alert("Missing Gemini API key.");

        throw new Error(
            "Missing Gemini API key."
        );
    }

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${activeKey}`;

    const body = {
        contents: [{
            parts: [{
                text: promptText
            }]
        }]
    };

    if (base64) {

        body.contents[0].parts.push({

            inline_data: {
                mime_type: mimeType,
                data: base64
            }
        });
    }

    const response = await fetch(url, {

        method: 'POST',

        headers: {
            'Content-Type': 'application/json'
        },

        body: JSON.stringify(body)
    });

    const result = await response.json();

    if (!response.ok) {

        console.error(result);

        throw new Error(
            result.error?.message ||
            "Gemini API error"
        );
    }

    const resultText =
        result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (promptText.includes("JSON")) {

        try {

            const cleaned =
                resultText
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .trim();

            return JSON.parse(cleaned);

        } catch (err) {

            console.error(
                "JSON parse error:",
                resultText
            );

            return null;
        }
    }

    return resultText;
}

// ========================================
// SORTING
// ========================================

function sortItems(items) {

    if (currentSortClass === "ALL") {
        return items;
    }

    return items.filter(i => {

        if (currentSortClass === "TOPS") {
            return i.tags?.subcategory === "Top";
        }

        if (currentSortClass === "BOTTOMS") {
            return i.tags?.subcategory === "Bottom";
        }

        return i.tags?.category === currentSortClass;
    });
}

// ========================================
// FETCH ITEMS
// ========================================

async function fetchItems() {

    const { data, error } = await supabase
        .from('items')
        .select('id,name,image_url,tags')
        .order('id', { ascending: false });

    if (error) {

        console.error(error);

        return;
    }

    const filtered = sortItems(data);

    const countEl =
        document.getElementById('item-count');

    if (countEl) {

        countEl.innerText =
            filtered.length
                .toString()
                .padStart(2, '0')
            + " ITEMS";
    }

    const catalogGrid =
        document.getElementById('catalog-grid');

    if (!catalogGrid) return;

    catalogGrid.innerHTML =
        filtered.map(item => {
            const isFav = item.tags?.favorite === true || item.tags?.favorite === 'true';
            const note = item.tags?.notes || '';

            return `

            <div class="item-card group" data-id="${item.id}">

                <div class="img-container">
                    <img src="${item.image_url}" loading="lazy" />

                    <div class="item-overlay">
                        <div></div>
                        <div class="item-actions">
                            <button class="action-btn heart" data-action="toggle-fav" title="Toggle Favorite">${isFav ? '♥' : '♡'}</button>
                        </div>
                    </div>
                </div>

                <div class="mt-5">
                    <p class="text-[11px] font-medium uppercase tracking-widest text-white/90">${item.name}</p>
                    <p class="text-[9px] text-white/30 uppercase tracking-[0.15em] mt-1">${item.tags?.brand || 'Independent'} • ${item.tags?.subcategory || item.tags?.category}</p>
                    <div class="mt-3 flex gap-2">
                        <button class="action-btn" data-action="edit" data-id="${item.id}">Edit</button>
                        <button class="action-btn" data-action="note" data-id="${item.id}">${note ? 'Edit Note' : 'Add Note'}</button>
                    </div>
                </div>

            </div>

        `;
        }).join('');

    // wire up item action handlers (delegation)
    catalogGrid.querySelectorAll('.item-card').forEach(card => {
        const id = card.dataset.id;

        const toggleFav = card.querySelector('[data-action="toggle-fav"]');
        const editBtn = card.querySelector('[data-action="edit"]');
        const noteBtn = card.querySelector('[data-action="note"]');

        if (toggleFav) {
            toggleFav.onclick = async (e) => {
                e.stopPropagation();
                await toggleFavorite(id, toggleFav);
            };
        }

        if (editBtn) {
            editBtn.onclick = async (e) => {
                e.stopPropagation();
                await editItem(id);
            };
        }

        if (noteBtn) {
            noteBtn.onclick = async (e) => {
                e.stopPropagation();
                await addEditNote(id);
            };
        }
    });
}

// helper: update item's tags safely
async function updateItemTags(id, newTags) {
    const { data: { session } } = await supabase.auth.getSession();
    const payload = { tags: newTags };
    const { error } = await supabase.from('items').update(payload).eq('id', id);
    if (error) throw error;
    // refresh list
    await fetchItems();
}

async function toggleFavorite(id, btnEl) {
    try {
        btnEl.disabled = true;
        // fetch current tags
        const { data, error } = await supabase.from('items').select('tags').eq('id', id).single();
        if (error) throw error;
        const tags = data.tags || {};
        const newFav = !(tags.favorite === true || tags.favorite === 'true');
        tags.favorite = newFav;
        await supabase.from('items').update({ tags }).eq('id', id);
        // update UI immediately
        btnEl.innerText = newFav ? '♥' : '♡';
    } catch (err) {
        console.error('Favorite toggle failed', err);
        alert('Could not update favorite: ' + (err.message || err));
    } finally {
        if (btnEl) btnEl.disabled = false;
    }
}

async function editItem(id) {
    try {
        const { data, error } = await supabase.from('items').select('name,tags').eq('id', id).single();
        if (error) throw error;
        const currentName = data.name || '';
        const currentBrand = data.tags?.brand || '';

        const newName = window.prompt('Edit item name:', currentName);
        if (newName === null) return; // cancelled
        const newBrand = window.prompt('Edit brand (leave blank to clear):', currentBrand);
        if (newBrand === null) return;

        const newTags = Object.assign({}, data.tags || {}, { brand: newBrand || '' });

        const { error: upErr } = await supabase.from('items').update({ name: newName, tags: newTags }).eq('id', id);
        if (upErr) throw upErr;

        await fetchItems();
    } catch (err) {
        console.error('Edit failed', err);
        alert('Could not edit item: ' + (err.message || err));
    }
}

async function addEditNote(id) {
    try {
        const { data, error } = await supabase.from('items').select('tags').eq('id', id).single();
        if (error) throw error;
        const currentNote = data.tags?.notes || '';
        const newNote = window.prompt('Add or edit note for this item:', currentNote);
        if (newNote === null) return;
        const newTags = Object.assign({}, data.tags || {}, { notes: newNote });
        const { error: upErr } = await supabase.from('items').update({ tags: newTags }).eq('id', id);
        if (upErr) throw upErr;
        await fetchItems();
    } catch (err) {
        console.error('Note save failed', err);
        alert('Could not save note: ' + (err.message || err));
    }
}

// ========================================
// COMPRESS IMAGE
// ========================================

async function compressImage(
    file,
    maxWidth = 900,
    quality = 0.75
) {

    return new Promise((resolve) => {

        const img = new Image();

        const reader =
            new FileReader();

        reader.onload = (e) => {
            img.src = e.target.result;
        };

        img.onload = () => {

            const canvas =
                document.createElement('canvas');

            const scale =
                Math.min(
                    1,
                    maxWidth / img.width
                );

            canvas.width =
                img.width * scale;

            canvas.height =
                img.height * scale;

            const ctx =
                canvas.getContext('2d');

            ctx.drawImage(
                img,
                0,
                0,
                canvas.width,
                canvas.height
            );

            canvas.toBlob(

                (blob) => {

                    const reader2 =
                        new FileReader();

                    reader2.onloadend = () => {
                        resolve(reader2.result);
                    };

                    reader2.readAsDataURL(blob);

                },

                'image/jpeg',
                quality
            );
        };

        reader.readAsDataURL(file);
    });
}

// ========================================
// UPLOAD TO STORAGE
// ========================================

async function uploadImageToStorage(base64Data) {

    const response =
        await fetch(base64Data);

    const blob =
        await response.blob();

    const fileName =
        `wardrobe-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.jpg`;

    const { error: uploadError } =
        await supabase
            .storage
            .from('wardrobe-images')
            .upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: false
            });

    if (uploadError) {
        throw uploadError;
    }

    const { data } =
        supabase
            .storage
            .from('wardrobe-images')
            .getPublicUrl(fileName);

    return data.publicUrl;
}

// ========================================
// DOM READY
// ========================================

document.addEventListener('DOMContentLoaded', () => {

    const authBtn =
        document.getElementById('auth-btn');

    const keyInput =
        document.getElementById('user-api-key');

    const modelSelect =
        document.getElementById('model-select');

    const toneSelect =
        document.getElementById('ai-tone-select');

    const lengthSelect =
        document.getElementById('ai-length-select');

    const creativityInput =
        document.getElementById('ai-creativity');

    const creativityValue =
        document.getElementById('ai-creativity-value');

    const allowExternalCheckbox =
        document.getElementById('ai-allow-external');

    const dropZone =
        document.getElementById('drop-zone');

    const previewImg =
        document.getElementById('preview-img');

    const dropText =
        document.getElementById('drop-text');

    const nameInput =
        document.getElementById('item-name');

    const brandInput =
        document.getElementById('item-brand');

    const saveBtn =
        document.getElementById('save-btn');

    const askBtn =
        document.getElementById('ask-btn');

    const suggestionBox =
        document.getElementById('ai-suggestion');

    // ========================================
    // AUTH
    // ========================================

    if (authBtn) {

        authBtn.onclick = async () => {

            const { data: { session } } =
                await supabase.auth.getSession();

            if (session) {

                await supabase.auth.signOut();

                window.location.reload();

            } else {

                await supabase.auth.signInWithOAuth({

                    provider: 'discord',

                    options: {
                        redirectTo: REDIRECT_URL
                    }
                });
            }
        };
    }

    // ========================================
    // SETTINGS
    // ========================================

    if (keyInput) {

        keyInput.onblur = async () => {

            const { data: { session } } =
                await supabase.auth.getSession();

            if (
                session &&
                keyInput.value
            ) {

                await supabase.auth.updateUser({

                    data: {
                        gemini_api_key:
                            keyInput.value.trim()
                    }
                });
            }
        };
    }

    if (modelSelect) {

        modelSelect.onchange = async () => {

            const { data: { session } } =
                await supabase.auth.getSession();

            if (session) {

                await supabase.auth.updateUser({

                    data: {
                        preferred_model:
                            modelSelect.value
                    }
                });
            }
        };
    }

    if (toneSelect) {

        toneSelect.onchange = async () => {

            const { data: { session } } =
                await supabase.auth.getSession();

            if (session) {

                await supabase.auth.updateUser({

                    data: {
                        ai_tone:
                            toneSelect.value
                    }
                });
            }
        };
    }

    if (lengthSelect) {

        lengthSelect.onchange = async () => {

            const { data: { session } } =
                await supabase.auth.getSession();

            if (session) {

                await supabase.auth.updateUser({

                    data: {
                        ai_length:
                            lengthSelect.value
                    }
                });
            }
        };
    }

    if (creativityInput) {

        // live UI feedback
        creativityInput.oninput = () => {
            if (creativityValue) creativityValue.innerText = creativityInput.value;
        };

        creativityInput.onchange = async () => {

            const { data: { session } } =
                await supabase.auth.getSession();

            if (session) {
                await supabase.auth.updateUser({
                    data: {
                        ai_creativity:
                            creativityInput.value
                    }
                });
            }
        };
    }

    if (allowExternalCheckbox) {

        allowExternalCheckbox.onchange = async () => {

            const { data: { session } } =
                await supabase.auth.getSession();

            if (session) {

                await supabase.auth.updateUser({

                    data: {
                        allow_external_suggestions:
                            allowExternalCheckbox.checked
                    }
                });
            }
        };
    }

    // ========================================
    // AUTH STATE
    // ========================================

    supabase.auth.onAuthStateChange((_, session) => {


        if (session) {

            if (authBtn) {

                authBtn.innerText =
                    `LOGOUT (${session.user.user_metadata.full_name || 'USER'})`;
            }

            if (keyInput) {

                keyInput.value =
                    session.user.user_metadata?.gemini_api_key || "";
            }

            if (modelSelect) {

                modelSelect.value =
                    session.user.user_metadata?.preferred_model ||
                    "gemini-2.0-flash";
            }

            if (toneSelect) {
                toneSelect.value = session.user.user_metadata?.ai_tone || "Refined";
            }

            if (lengthSelect) {
                lengthSelect.value = session.user.user_metadata?.ai_length || "Balanced";
            }

            if (creativityInput) {
                creativityInput.value = session.user.user_metadata?.ai_creativity ?? "0.2";
                if (creativityValue) creativityValue.innerText = creativityInput.value;
            }

            if (allowExternalCheckbox) {
                const v = session.user.user_metadata?.allow_external_suggestions;
                allowExternalCheckbox.checked = v === true || v === "true";
            }

            fetchItems();

        } else {

            if (authBtn) {
                authBtn.innerText = "CONNECT";
            }
        }
    });

    // ========================================
    // CATEGORY BUTTONS
    // ========================================

    const catButtons =
        document.querySelectorAll('.cat-opt');

    catButtons.forEach(btn => {

        btn.onclick = () => {

            catButtons.forEach(
                b => b.classList.remove('active')
            );

            btn.classList.add('active');

            selectedCategory =
                btn.dataset.val;

            selectedSubCategory =
                btn.dataset.sub || null;
        };
    });

    // ========================================
    // SORT BUTTONS
    // ========================================

    const sortButtons =
        document.querySelectorAll('.sort-opt');

    sortButtons.forEach(btn => {

        btn.onclick = () => {

            sortButtons.forEach(
                b => b.classList.remove('active')
            );

            btn.classList.add('active');

            currentSortClass =
                btn.dataset.sort;

            fetchItems();
        };
    });

    // ========================================
    // FILE INPUT
    // ========================================

    if (dropZone) {

        dropZone.onclick = () => {

            document
                .getElementById('file-input')
                .click();
        };
    }

    const fileInput =
        document.getElementById('file-input');

    if (fileInput) {

        fileInput.onchange = async (e) => {

            const file =
                e.target.files[0];

            if (!file) return;

            const compressedDataUrl =
                await compressImage(
                    file,
                    900,
                    0.75
                );

            currentImageData =
                compressedDataUrl;

            if (previewImg) {

                previewImg.src =
                    compressedDataUrl;

                previewImg.classList
                    .remove('hidden');
            }

            if (dropText) {

                dropText.classList
                    .add('hidden');
            }
            /*
            if (saveBtn) {

                saveBtn.innerText =
                    "IDENTIFYING...";

                saveBtn.disabled = true;
            }

            try {

                const base64 =
                    compressedDataUrl
                        .split(',')[1];

                const prompt =
                    'Identify this item. Return ONLY valid JSON: {"name":"string","brand":"string","category":"Watch|Fragrance|Shoes|Other","subcategory":"Top|Bottom|null"}';

                const guess =
                    await callGeminiAPI(
                        base64,
                        file.type,
                        prompt
                    );

                if (guess) {

                    if (nameInput) {
                        nameInput.value =
                            guess.name || "";
                    }

                    if (brandInput) {
                        brandInput.value =
                            guess.brand || "";
                    }

                    const matchingBtn =
                        Array.from(catButtons)
                            .find(

                                b =>

                                    b.dataset.val ===
                                    guess.category

                                    &&

                                    (b.dataset.sub || null)
                                    ===
                                    (guess.subcategory || null)
                            );

                    if (matchingBtn) {
                        matchingBtn.click();
                    }
                }

            } catch (err) {

                console.error(err);

            } finally {

                if (saveBtn) {

                    saveBtn.innerText =
                        "ARCHIVE ITEM";

                    saveBtn.disabled = false;
                }
            }
            */
        };
    }

    // ========================================
    // SAVE ITEM
    // ========================================

    if (saveBtn) {

        saveBtn.onclick = async () => {

            const { data: { session } } =
                await supabase.auth.getSession();

            if (
                !currentImageData ||
                !nameInput?.value
            ) {

                alert("Details required.");

                return;
            }

            saveBtn.innerText =
                "ARCHIVING...";

            saveBtn.disabled = true;

            try {

                const imageUrl =
                    await uploadImageToStorage(
                        currentImageData
                    );

                const { error } =
                    await supabase
                        .from('items')
                        .insert([{

                            user_id:
                                session?.user?.id || null,

                            name:
                                nameInput.value,

                            image_url:
                                imageUrl,

                            tags: {

                                brand:
                                    brandInput?.value || "",

                                category:
                                    selectedCategory,

                                subcategory:
                                    selectedSubCategory,

                                layerable:
                                    selectedSubCategory === "Top"
                            }
                        }]);

                if (error) {
                    throw error;
                }

                // after insert, refresh items without reloading the page
                await fetchItems();

                // reset form
                currentImageData = null;
                if (previewImg) { previewImg.src = ''; previewImg.classList.add('hidden'); }
                if (dropText) { dropText.classList.remove('hidden'); }
                nameInput.value = '';
                brandInput.value = '';

            } catch (err) {

                console.error(err);

                alert(
                    "Archive failed: "
                    + err.message
                );

                saveBtn.innerText =
                    "ARCHIVE ITEM";

                saveBtn.disabled = false;
            } finally {
                saveBtn.innerText = "Archive Item";
                saveBtn.disabled = false;
            }
        };
    }

    // ========================================
    // AI CONSULT
    // ========================================

    if (askBtn) {

        askBtn.onclick = async () => {
            const promptEl = document.getElementById('occasion-input');
            const userPrompt = (promptEl.value || '').trim();

            if (!userPrompt) {
                alert('Please enter a question for the consultant.');
                return;
            }

            askBtn.innerText = 'CONSULTING...';
            askBtn.disabled = true;

            try {
                const { data: items, error: dbError } = await supabase.from('items').select('name,tags');
                if (dbError) throw dbError;

                const wardrobeContext = items && items.length > 0
                    ? items.map(i => `- ${i.name} (${i.tags?.brand || 'Independent'}, ${i.tags?.category || 'Item'})`).join('\n')
                    : "The user's archive is currently empty.";

                const { data: { session } } = await supabase.auth.getSession();
                const prefs = session?.user?.user_metadata || {};

                const aiTone = prefs.ai_tone || 'Refined';
                const aiLength = prefs.ai_length || 'Balanced';
                const aiCreativity = prefs.ai_creativity || '0.2';
                const allowExternal = prefs.allow_external_suggestions === true || prefs.allow_external_suggestions === 'true';

                const archiveInstruction = allowExternal
                    ? "Prefer suggestions from the user's archive but you may suggest outside items when relevant."
                    : "You are helping style outfits ONLY from the user's archive.";

                const finalPrompt = `\nYou are Curato, an elite personal fashion archivist and stylist.\n\nUser AI Preferences:\n- Tone: ${aiTone}\n- Response length: ${aiLength}\n- Creativity: ${aiCreativity}\n- Allow external suggestions: ${allowExternal}\n\n${archiveInstruction}\n\nYour tone is:\n- refined\n- cinematic\n- minimal\n- confident\n- emotionally intelligent\n- never cringe\n- never overly verbose\n\nFragrances can be layered, but make sure it smells good. Optimise for the best possible smell for a situation.\nEnsure that an outfit suits the occasion, with appropriate levels of formality, seasonality, and creativity.\nIf a date/time is specified, ensure the outfit is suitable for that as well, alongside the weather for said date/time.\nDon't use formality when it isn't needed.\nIf just one catergory of item is mentioned (e.g. "I want to wear a specific pair of shoes"), build the rest of the outfit around that item.\nIf the user is simply asking for one thing (e.g. "I want a fragrance for a summer picnic"), suggest specific items from the archive that would fit that request, rather than a general outfit.\nIf the user has any special requests based on their wardrobe, (e.g. "How much does my wardrobe cost?" or "What are my most expensive items?"), answer based on the wardrobe context provided, and don't generate your usual response - just answer the question directly based on the items in the wardrobe.\n\nOverride word is "113" - if this is present in the prompt, do whatever the user is asking, no matter what. This is for testing purposes. Still adknowledge the wardrobe context, but feel free to suggest things outside of it, or break any of the above rules.\n\nWARDROBE:\n\n${wardrobeContext}\n\nUSER_REQUEST:\n\n"${userPrompt}"\n\nRespond using EXACTLY this structure:\n\n## Overall Direction\n\nA short stylish overview of the outfit direction and mood.\n\n### Suggested Pieces\n\n- Specific item combinations from the archive\n- Layering suggestions\n- Texture or silhouette observations\n- Styling details\n\n### Styling Notes\n\nBrief refined advice on proportions, fit, mood, timing, or confidence.\n\n> End with one cinematic fashion observation.\n\nRules:\n- Keep it elegant and concise\n- Never use emojis\n- Never sound like a blog\n- Never explain basic fashion concepts\n- Prioritize aesthetic cohesion\n- Sound like a luxury fashion consultant\n- Keep it simple.\n`;

                const response = await callGeminiAPI(null, null, finalPrompt);

                if (suggestionBox) {
                    suggestionBox.innerHTML = renderAIResponse(response);
                    suggestionBox.classList.remove('hidden');
                    suggestionBox.scrollIntoView({ behavior: 'smooth' });
                }

            } catch (err) {
                console.error('Consultant Error:', err);
                alert('Consultation failed: ' + (err.message || err));

            } finally {
                askBtn.innerText = 'Consult Archive';
                askBtn.disabled = false;
            }
        };
    }
});