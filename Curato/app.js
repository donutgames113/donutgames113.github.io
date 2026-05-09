const SUPABASE_URL = "https://wyvliczohxpyptwxnvfi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5";
const REDIRECT_URL = "https://donutgames113.github.io/Curato/index.html";
const THEME_STORAGE_KEY = "curato-theme";
const AVAILABLE_THEMES = ["dark", "light", "dune", "slate"];

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let selectedCategory = "Other";
let selectedSubCategory = null;
let currentImageData = null;
let currentSortClass = "ALL";

function applyTheme(themeName) {

    const nextTheme =
        AVAILABLE_THEMES.includes(themeName)
            ? themeName
            : "dark";

    document.body.dataset.theme =
        nextTheme;

    document.querySelectorAll(".theme-chip")
        .forEach((button) => {

            const isActive =
                button.dataset.theme === nextTheme;

            button.classList.toggle(
                "active",
                isActive
            );

            button.setAttribute(
                "aria-pressed",
                String(isActive)
            );
        });

    localStorage.setItem(
        THEME_STORAGE_KEY,
        nextTheme
    );
}

function setupThemePicker() {

    const savedTheme =
        localStorage.getItem(
            THEME_STORAGE_KEY
        ) || "dark";

    applyTheme(savedTheme);

    document.querySelectorAll(".theme-chip")
        .forEach((button) => {

            button.onclick = () => {
                applyTheme(
                    button.dataset.theme
                );
            };
        });
}

// ========================================
// AI RESPONSE RENDERER
// ========================================

function renderAIResponse(text) {

    text = text
        .replace(/```markdown/g, "")
        .replace(/```/g, "")
        .trim();

    const lines = text.split("\n");

    let html = "";
    let inList = false;

    lines.forEach((line) => {

        line = line.trim();

        if (!line) {
            if (inList) {
                html += "</ul>";
                inList = false;
            }
            return;
        }

        if (line.startsWith("## ")) {

            if (inList) {
                html += "</ul>";
                inList = false;
            }

            html += `
                <h2 class="text-3xl font-extralight ai-title mb-6 mt-2 tracking-tight">
                    ${line.replace("## ", "")}
                </h2>
            `;

            return;
        }

        if (line.startsWith("### ")) {

            if (inList) {
                html += "</ul>";
                inList = false;
            }

            html += `
                <h3 class="text-[10px] uppercase tracking-[0.3em] ai-subtitle mt-10 mb-4 pb-2">
                    ${line.replace("### ", "")}
                </h3>
            `;

            return;
        }

        if (
            line.startsWith("- ") ||
            line.startsWith("* ")
        ) {

            if (!inList) {
                html += `<ul class="space-y-4 mt-4">`;
                inList = true;
            }

            const clean = line
                .replace(/^[-*]\s/, "")
                .replace(
                    /\*\*(.*?)\*\*/g,
                    "<strong class=\"font-medium\">$1</strong>"
                );

            html += `
                <li class="flex gap-4 items-start ai-list-item">
                    <div class="w-1.5 h-1.5 rounded-full ai-list-bullet mt-2 shrink-0"></div>
                    <div class="text-sm leading-relaxed">
                        ${clean}
                    </div>
                </li>
            `;

            return;
        }

        if (line.startsWith("> ")) {

            if (inList) {
                html += "</ul>";
                inList = false;
            }

            html += `
                <blockquote class="ai-quote">
                    ${line.replace("> ", "")}
                </blockquote>
            `;

            return;
        }

        if (inList) {
            html += "</ul>";
            inList = false;
        }

        html += `
            <p class="text-[15px] leading-8 ai-paragraph mb-6 font-light">
                ${line.replace(
                    /\*\*(.*?)\*\*/g,
                    "<strong class=\"font-medium\">$1</strong>"
                )}
            </p>
        `;
    });

    if (inList) {
        html += "</ul>";
    }

    return html;
}

// ========================================
// GEMINI
// ========================================

async function callGeminiAPI(base64, mimeType, promptText) {

    const keyInput =
        document.getElementById("user-api-key");

    const modelSelect =
        document.getElementById("model-select");

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
        method: "POST",
        headers: {
            "Content-Type": "application/json"
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
                    .replace(/```json/g, "")
                    .replace(/```/g, "")
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

    return items.filter((item) => {

        if (currentSortClass === "TOPS") {
            return item.tags?.subcategory === "Top";
        }

        if (currentSortClass === "BOTTOMS") {
            return item.tags?.subcategory === "Bottom";
        }

        return item.tags?.category === currentSortClass;
    });
}

// ========================================
// FETCH ITEMS
// ========================================

async function fetchItems() {

    const { data, error } = await supabase
        .from("items")
        .select("id,name,image_url,tags")
        .order("id", { ascending: false });

    if (error) {

        console.error(error);

        return;
    }

    const filtered = sortItems(data);

    const countEl =
        document.getElementById("item-count");

    if (countEl) {

        countEl.innerText =
            filtered.length
                .toString()
                .padStart(2, "0")
            + " ITEMS";
    }

    const catalogGrid =
        document.getElementById("catalog-grid");

    if (!catalogGrid) return;

    catalogGrid.innerHTML =
        filtered.map((item) => `

        <div class="item-card group">

            <div class="img-container">

                <img
                    src="${item.image_url}"
                    loading="lazy"
                >

            </div>

            <div class="mt-5">

                <p class="item-name text-[11px] font-medium uppercase tracking-widest">
                    ${item.name}
                </p>

                <p class="item-meta text-[9px] uppercase tracking-[0.15em] mt-1">
                    ${item.tags?.brand || "Independent"}
                    &bull;
                    ${item.tags?.subcategory || item.tags?.category}
                </p>

            </div>

        </div>

    `).join("");
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

        reader.onload = (event) => {
            img.src = event.target.result;
        };

        img.onload = () => {

            const canvas =
                document.createElement("canvas");

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
                canvas.getContext("2d");

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
                "image/jpeg",
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
            .from("wardrobe-images")
            .upload(fileName, blob, {
                contentType: "image/jpeg",
                upsert: false
            });

    if (uploadError) {
        throw uploadError;
    }

    const { data } =
        supabase
            .storage
            .from("wardrobe-images")
            .getPublicUrl(fileName);

    return data.publicUrl;
}

// ========================================
// DOM READY
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    setupThemePicker();

    const authBtn =
        document.getElementById("auth-btn");

    const keyInput =
        document.getElementById("user-api-key");

    const modelSelect =
        document.getElementById("model-select");

    const dropZone =
        document.getElementById("drop-zone");

    const previewImg =
        document.getElementById("preview-img");

    const dropText =
        document.getElementById("drop-text");

    const nameInput =
        document.getElementById("item-name");

    const brandInput =
        document.getElementById("item-brand");

    const saveBtn =
        document.getElementById("save-btn");

    const askBtn =
        document.getElementById("ask-btn");

    const suggestionBox =
        document.getElementById("ai-suggestion");

    if (authBtn) {

        authBtn.onclick = async () => {

            const { data: { session } } =
                await supabase.auth.getSession();

            if (session) {

                await supabase.auth.signOut();
                window.location.reload();

            } else {

                await supabase.auth.signInWithOAuth({
                    provider: "discord",
                    options: {
                        redirectTo: REDIRECT_URL
                    }
                });
            }
        };
    }

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

    supabase.auth.onAuthStateChange((_, session) => {

        if (session) {

            if (authBtn) {
                authBtn.innerText =
                    `LOGOUT (${session.user.user_metadata.full_name || "USER"})`;
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

        } else if (authBtn) {
            authBtn.innerText = "CONNECT";
        }
    });

    const catButtons =
        document.querySelectorAll(".cat-opt");

    catButtons.forEach((button) => {

        button.onclick = () => {

            catButtons.forEach((chip) =>
                chip.classList.remove("active")
            );

            button.classList.add("active");

            selectedCategory =
                button.dataset.val;

            selectedSubCategory =
                button.dataset.sub || null;
        };
    });

    const sortButtons =
        document.querySelectorAll(".sort-opt");

    sortButtons.forEach((button) => {

        button.onclick = () => {

            sortButtons.forEach((chip) =>
                chip.classList.remove("active")
            );

            button.classList.add("active");

            currentSortClass =
                button.dataset.sort;

            fetchItems();
        };
    });

    if (dropZone) {

        dropZone.onclick = () => {
            document
                .getElementById("file-input")
                .click();
        };
    }

    const fileInput =
        document.getElementById("file-input");

    if (fileInput) {

        fileInput.onchange = async (event) => {

            const file =
                event.target.files[0];

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
                    .remove("hidden");
            }

            if (dropText) {
                dropText.classList
                    .add("hidden");
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
                        .split(",")[1];

                const prompt =
                    "Identify this item. Return ONLY valid JSON: {\"name\":\"string\",\"brand\":\"string\",\"category\":\"Watch|Fragrance|Other\",\"subcategory\":\"Top|Bottom|null\"}";

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
                            .find((chip) =>
                                chip.dataset.val ===
                                guess.category
                                &&
                                (chip.dataset.sub || null)
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
                        .from("items")
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

    if (askBtn) {

        askBtn.onclick = async () => {

            const promptEl =
                document.getElementById("occasion-input");

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
                        .from("items")
                        .select("name,tags");

                if (dbError) {
                    throw dbError;
                }

                const wardrobeContext =
                    items && items.length > 0
                        ? items.map((item) =>
                            `- ${item.name} (${item.tags?.brand || "Independent"}, ${item.tags?.category || "Item"})`
                        ).join("\n")
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

WARDROBE:

${wardrobeContext}

USER REQUEST:

"${userPrompt}"

Respond using EXACTLY this structure:

## Overall Direction

A short stylish overview of the outfit direction and mood.

### Suggested Pieces

- Specific item combinations from the archive
- Layering suggestions
- Texture or silhouette observations
- Styling details

### Styling Notes

Brief refined advice on proportions, fit, mood, timing, or confidence.

> End with one cinematic fashion observation.

Rules:
- Keep it elegant and concise
- Never use emojis
- Never sound like a blog
- Never explain basic fashion concepts
- Prioritize aesthetic cohesion
- Sound like a luxury fashion consultant
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

                    suggestionBox.classList.remove("hidden");

                    suggestionBox.scrollIntoView({
                        behavior: "smooth"
                    });
                }

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
