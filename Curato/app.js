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

    return text
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(
            /^\* \*\*(.*?)\*\*(.*$)/gim,
            '<li><strong>$1</strong>$2</li>'
        )
        .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/\n/g, '<br>');
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
        "gemini-1.5-flash";

    if (!activeKey) {
        alert("Missing Gemini API key.");
        throw new Error("Missing Gemini API key.");
    }

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${activeKey}`;

    const body = {
        contents: [{
            parts: [{ text: promptText }]
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

    if (!response.ok) {

        const err = await response.json();

        throw new Error(
            err.error?.message || "Gemini API error"
        );
    }

    const res = await response.json();

    const resultText =
        res.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (promptText.includes("JSON")) {

        const cleaned =
            resultText
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

        return JSON.parse(cleaned);
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
            filtered.length.toString().padStart(2, '0')
            + " ITEMS";
    }

    const catalogGrid =
        document.getElementById('catalog-grid');

    if (!catalogGrid) return;

    catalogGrid.innerHTML = filtered.map(item => `

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
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target.result;
        };

        img.onload = () => {

            const canvas =
                document.createElement('canvas');

            const scale =
                Math.min(1, maxWidth / img.width);

            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

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
// MIGRATE ALL IMAGES
// ========================================

async function migrateImagesToStorage() {

    console.log("================================");
    console.log("STARTING FULL MIGRATION");
    console.log("================================");

    const { data: items, error } =
        await supabase
            .from('items')
            .select('id,image_url');

    if (error) {

        console.error(
            "FAILED TO FETCH ITEMS:",
            error
        );

        return;
    }

    console.log(
        `FOUND ${items.length} ITEMS`
    );

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of items) {

        try {

            if (!item.image_url) {

                skipped++;
                continue;
            }

            if (item.image_url.startsWith('http')) {

                console.log(
                    `SKIPPED ${item.id} (already migrated)`
                );

                skipped++;
                continue;
            }

            console.log(
                `MIGRATING ${item.id}...`
            );

            const publicUrl =
                await uploadImageToStorage(
                    item.image_url
                );

            const { error: updateError } =
                await supabase
                    .from('items')
                    .update({
                        image_url: publicUrl
                    })
                    .eq('id', item.id);

            if (updateError) {

                console.error(
                    `FAILED UPDATE ${item.id}`,
                    updateError
                );

                failed++;
                continue;
            }

            migrated++;

            console.log(
                `SUCCESS ${item.id}`
            );

        } catch (err) {

            console.error(
                `FAILED ${item.id}`,
                err
            );

            failed++;
        }
    }

    console.log("================================");
    console.log("MIGRATION COMPLETE");
    console.log("================================");
    console.log("Migrated:", migrated);
    console.log("Skipped:", skipped);
    console.log("Failed:", failed);
    console.log("================================");

    alert(
        `Migration complete.\n\nMigrated: ${migrated}\nSkipped: ${skipped}\nFailed: ${failed}`
    );

    location.reload();
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

            if (session && keyInput.value) {

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
    // IMPORTANT:
    // DO NOT FETCH ITEMS YET
    // ========================================

    supabase.auth.onAuthStateChange((_, session) => {

        if (session) {

            if (authBtn) {

                authBtn.innerText =
                    `LOGOUT (${session.user.user_metadata.full_name || 'USER'})`;
            }

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
                    'Identify this item. Return ONLY valid JSON: {"name":"string","brand":"string","category":"Watch|Fragrance|Other","subcategory":"Top|Bottom|null"}';

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
        };
    }

    // ========================================
    // SAVE ITEM
    // ========================================

    if (saveBtn) {

        saveBtn.onclick = async () => {

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

            alert(
                "Disabled during migration."
            );
        };
    }
});
