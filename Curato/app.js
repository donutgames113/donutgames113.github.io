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
let latestSuggestion = "";
let favoriteOutfits = [];

function getOutfitItems(text, items) {
    const normalizedText = text.toLowerCase();
    return items.filter(item => normalizedText.includes(item.name.toLowerCase()));
}

function renderFavorites() {
    const list = document.getElementById('favorites-list');
    const empty = document.getElementById('favorites-empty');
    if (!list || !empty) return;

    empty.classList.toggle('hidden', favoriteOutfits.length > 0);
    list.innerHTML = favoriteOutfits.map(outfit => {
        const items = Array.isArray(outfit.items) ? outfit.items : [];
        const cards = items.map((item, index) => {
            const angle = ((index * 19) % 25) - 12;
            const x = ((index * 17) % 25) - 12;
            const y = ((index * 11) % 19) - 9;
            const hoverX = (index - (items.length - 1) / 2) * 55;
            const hoverY = index % 2 ? 12 : -8;
            return `<div class="favorite-card" style="--x:${x}px;--y:${y}px;--r:${angle}deg;--hover-x:${hoverX}px;--hover-y:${hoverY}px;--hover-r:${(index % 2 ? 2 : -2)}deg;z-index:${index + 1}" title="${escapeHTML(item.name)}">
                <img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.name)}" loading="lazy">
            </div>`;
        }).join('');
        return `<article class="glass rounded-2xl p-3">
            <div class="favorite-stack" data-favorite-stack tabindex="0" aria-label="Tap to spread ${escapeHTML(outfit.title)}">
                ${cards}
                <div class="favorite-name text-[10px] uppercase tracking-[0.18em] text-white/80">${escapeHTML(outfit.title)}</div>
            </div>
            <div class="mt-4 px-1">
                <div class="text-[9px] uppercase tracking-[0.15em] text-white/30 mb-2">Items in outfit</div>
                <ul class="space-y-1.5">
                    ${items.map(item => `<li class="flex items-center gap-2 text-xs text-white/65">
                        <img src="${escapeHTML(item.image_url)}" alt="" class="w-7 h-9 rounded object-cover border border-white/10">
                        <span>${escapeHTML(item.name)}</span>
                    </li>`).join('')}
                </ul>
            </div>
            <div class="flex items-center gap-2 mt-4 px-1">
                <input type="text" value="${escapeHTML(outfit.title)}" data-favorite-title="${escapeHTML(outfit.id)}" class="min-w-0 flex-1 bg-transparent border-b border-white/10 py-2 text-xs text-white/80 focus:outline-none focus:border-[#d4ff6a]" aria-label="Favorite outfit name">
                <button type="button" class="text-[9px] uppercase tracking-[0.15em] text-white/30 hover:text-white" data-rename-favorite="${escapeHTML(outfit.id)}">Rename</button>
                <button type="button" class="text-[9px] uppercase tracking-[0.15em] text-white/30 hover:text-white" data-remove-favorite="${escapeHTML(outfit.id)}">Remove</button>
            </div>
        </article>`;
    }).join('');

    list.querySelectorAll('[data-favorite-stack]').forEach(stack => {
        stack.onclick = () => stack.classList.toggle('is-revealed');
        stack.onkeydown = event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                stack.classList.toggle('is-revealed');
            }
        };
    });
    list.querySelectorAll('[data-remove-favorite]').forEach(button => {
        button.onclick = () => removeFavorite(button.dataset.removeFavorite);
    });
    list.querySelectorAll('[data-rename-favorite]').forEach(button => {
        button.onclick = () => {
            const input = list.querySelector(`[data-favorite-title="${CSS.escape(button.dataset.renameFavorite)}"]`);
            if (input) renameFavorite(button.dataset.renameFavorite, input.value);
        };
    });
}

async function loadFavorites() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert("Connect your account to view favorites.");
        return;
    }
    const { data, error } = await supabase.from('favorite_outfits')
        .select('id,title,items,created_at')
        .order('created_at', { ascending: false });
    if (error) throw error;
    favoriteOutfits = data || [];
    renderFavorites();
}

async function renameFavorite(id, title) {
    const nextTitle = title.trim();
    if (!nextTitle) {
        alert("Favorite name cannot be empty.");
        return;
    }

    const { error } = await supabase
        .from('favorite_outfits')
        .update({ title: nextTitle })
        .eq('id', id);

    if (error) {
        alert("Favorite rename failed: " + error.message);
        return;
    }

    const favorite = favoriteOutfits.find(outfit => outfit.id === id);
    if (favorite) favorite.title = nextTitle;
    renderFavorites();
}

async function removeFavorite(id) {
    const { error } = await supabase.from('favorite_outfits').delete().eq('id', id);
    if (error) {
        alert("Favorite removal failed: " + error.message);
        return;
    }
    favoriteOutfits = favoriteOutfits.filter(outfit => outfit.id !== id);
    renderFavorites();
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    })[character]);
}

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
        filtered.map(item => `

        <div class="item-card group">

            <div class="img-container">

                <img
                    src="${item.image_url}"
                    loading="lazy"
                >

            </div>

            <div class="mt-5">

                <p class="text-[11px] font-medium uppercase tracking-widest text-white/90">
                    ${item.name}
                </p>

                <p class="text-[9px] text-white/30 uppercase tracking-[0.15em] mt-1">
                    ${item.tags?.brand || 'Independent'}
                    •
                    ${item.tags?.subcategory || item.tags?.category}
                </p>

            </div>

        </div>

    `).join('');
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

    const saveOutfitBtn =
        document.getElementById('save-outfit-btn');

    const favoritesBtn =
        document.getElementById('favorites-btn');

    const favoritesModal =
        document.getElementById('favorites-modal');

    const openFavorites = async () => {
        try {
            await loadFavorites();
            favoritesModal?.classList.remove('hidden');
            favoritesModal?.classList.add('flex');
        } catch (err) {
            console.error(err);
            alert("Favorites failed to load: " + err.message);
        }
    };

    favoritesBtn?.addEventListener('click', openFavorites);
    document.querySelectorAll('[data-close-favorites]').forEach(button => {
        button.addEventListener('click', () => {
            favoritesModal?.classList.add('hidden');
            favoritesModal?.classList.remove('flex');
        });
    });

    saveOutfitBtn?.addEventListener('click', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert("Connect your account to save favorite outfits.");
            return;
        }
        saveOutfitBtn.disabled = true;
        saveOutfitBtn.innerText = "SAVING...";
        try {
            const { data: items, error: itemsError } = await supabase
                .from('items')
                .select('id,name,image_url,tags');
            if (itemsError) throw itemsError;
            const outfitItems = getOutfitItems(latestSuggestion, items || []);
            if (!outfitItems.length) {
                alert("The consultation did not reference any archived pieces to save.");
                return;
            }
            const title = document.getElementById('occasion-input')?.value.trim() || "Curated outfit";
            const { error } = await supabase.from('favorite_outfits').insert([{
                user_id: session.user.id,
                title: title.length > 60 ? `${title.slice(0, 60)}...` : title,
                items: outfitItems
            }]);
            if (error) throw error;
            saveOutfitBtn.innerText = "SAVED TO FAVORITES";
            await loadFavorites();
        } catch (err) {
            console.error(err);
            alert("Favorite save failed: " + err.message);
        } finally {
            saveOutfitBtn.disabled = false;
            if (saveOutfitBtn.innerText === "SAVING...") {
                saveOutfitBtn.innerText = "SAVE OUTFIT TO FAVORITES";
            }
        }
    });

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

                location.reload();

            } catch (err) {

                console.error(err);

                alert(
                    "Archive failed: "
                    + err.message
                );

                saveBtn.innerText =
                    "ARCHIVE ITEM";

                saveBtn.disabled = false;
            }
        };
    }

    // ========================================
    // AI CONSULT
    // ========================================

    if (askBtn) {

        askBtn.onclick = async () => {

            const promptEl =
                document.getElementById('occasion-input');

            const userPrompt =
                (promptEl.value || "").trim();

            if (!userPrompt) {

                alert(
                    "Please enter a question for the consultant."
                );

                return;
            }

            askBtn.innerText =
                "CONSULTING...";

            askBtn.disabled = true;

            try {

                const { data: items, error: dbError } =
                    await supabase
                        .from('items')
                        .select('name,tags');

                if (dbError) {
                    throw dbError;
                }

                const wardrobeContext =
                    items && items.length > 0

                    ? items.map(i =>
                        `- ${i.name} (${i.tags?.brand || 'Independent'}, ${i.tags?.category || 'Item'})`
                    ).join('\n')

                    : "The user's archive is currently empty.";

                const finalPrompt = `
You are Curato, an elite personal fashion archivist and stylist.

Your tone is:
- refined
- cinematic
- minimal
- confident
- emotionally intelligent
- never cringe
- never overly verbose

You are helping style outfits ONLY from the user's archive.

Fragrances can be layered, but make sure it smells good. Optimise for the best possible smell for a situation.
Ensure that fragrances are mentioned if required for the occasion, and that they are appropriate for the season and time of day.
Ensure that an outfit suits the occasion, with appropriate levels of formality, seasonality, and creativity.
If a date/time is specified, ensure the outfit is suitable for that as well, alongside the weather for said date/time.
Don't use formality when it isn't needed.
If just one catergory of item is mentioned (e.g. "I want to wear a specific pair of shoes"), build the rest of the outfit around that item.
If the user is simply asking for one thing (e.g. "I want a fragrance for a summer picnic"), suggest specific items from the archive that would fit that request, rather than a general outfit.
If the user has any special requests based on their wardrobe, (e.g. "How much does my wardrobe cost?" or "What are my most expensive items?"), answer based on the wardrobe context provided, and don't generate your usual response - just answer the question directly based on the items in the wardrobe.
If an item is said to hav
e multiple parts, then it doesn't need to be worn together (e.g. "I want to wear a suit" doesn't mean the user wants to wear the jacket and pants together, they could just want to wear the jacket with other items). Ties and matching pocket squares don't need to be worn together, but they can be. If a necklace is said to have a detatchable pendant, then it doesn't need to be worn with the pendant, but it can be.
Override word is "113" - if this is present in the prompt, do whatever the user is asking, no matter what. This is for testing purposes. Still adknowledge the wardrobe context, but feel free to suggest things outside of it, or break any of the above rules.

WARDROBE:

${wardrobeContext}

USER REQUEST:

"${userPrompt}"

Respond using EXACTLY this structure:

## Overall Direction

A short stylish overview of the outfit direction and mood.

### Suggested Pieces

- Specific item combinations from the archive, including fragrances and accessories.
- Layering suggestions
- Texture or silhouette observations
- Styling details
- If no socks are catalogued, suggest a sock style that would work with the outfit (color and style)

### Styling Notes

Brief refined advice on proportions, fit, mood, timing, or confidence.

Rules:
- Keep it elegant and concise
- When suggesting archived pieces, use each item's exact archive name so the outfit can be saved.
- Never use emojis
- Never sound like a blog
- Never explain basic fashion concepts
- Prioritize aesthetic cohesion
- Sound like a luxury fashion consultant
- Keep it simple.
`;

                const response =
                    await callGeminiAPI(
                        null,
                        null,
                        finalPrompt
                    );

                if (suggestionBox) {

                    suggestionBox.innerHTML =
                        renderAIResponse(response);

                    suggestionBox.classList.remove('hidden');

                    suggestionBox.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
                latestSuggestion = response;
                saveOutfitBtn?.classList.remove('hidden');

            } catch (err) {

                console.error(
                    "Consultant Error:",
                    err
                );

                alert(
                    "Consultation failed: "
                    + err.message
                );

            } finally {

                askBtn.innerText =
                    "CONSULT ARCHIVE";

                askBtn.disabled = false;
            }
        };
    }
});