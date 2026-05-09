const SUPABASE_URL = "https://wyvliczohxpyptwxnvfi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5";
const REDIRECT_URL = "https://donutgames113.github.io/Curato/index.html";
const THEME_STORAGE_KEY = "curato-theme";
const AVAILABLE_THEMES = ["dark", "light", "dune", "slate"];
const ACCESSORY_CATEGORIES = [
    "Accessory",
    "Jewelry",
    "Bag",
    "Headwear"
];
const CATEGORY_LABELS = {
    Fragrance: "Scent",
    Watch: "Watch",
    Shoes: "Shoes",
    Socks: "Socks",
    Accessory: "Accessory",
    Jewelry: "Jewelry",
    Bag: "Bag",
    Headwear: "Headwear",
    Other: "Other"
};

const FORM_TAG_GROUPS = [
    {
        id: "season",
        label: "Season",
        multi: false,
        options: ["All-season", "Spring", "Summer", "Autumn", "Winter"]
    },
    {
        id: "occasions",
        label: "Occasion",
        multi: true,
        options: ["Everyday", "Work", "Evening", "Travel", "Formal"]
    },
    {
        id: "palette",
        label: "Palette",
        multi: false,
        options: ["Monochrome", "Earth", "Warm", "Cool", "Accent"]
    },
    {
        id: "vibes",
        label: "Vibe",
        multi: true,
        options: ["Minimal", "Tailored", "Relaxed", "Technical", "Statement"]
    }
];

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let currentImageData = null;
let editingItemId = null;
let editingImageUrl = null;
let allItems = [];
let isSaving = false;

let formState = getDefaultFormState();

function getDefaultFormState() {
    return {
        category: "Other",
        subcategory: null,
        season: "All-season",
        occasions: ["Everyday"],
        palette: "Monochrome",
        vibes: ["Minimal"]
    };
}

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

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function toReadableLabel(value) {

    return String(value || "")
        .replace(/-/g, " ");
}

function normalizeTagArray(value) {

    if (Array.isArray(value)) {
        return value
            .map((entry) => String(entry || "").trim())
            .filter(Boolean);
    }

    if (typeof value === "string") {
        return value.trim()
            ? [value.trim()]
            : [];
    }

    return [];
}

function normalizeItem(item) {

    const rawTags =
        item?.tags || {};

    const season =
        rawTags.season ||
        rawTags.seasons?.[0] ||
        "All-season";

    const occasions =
        normalizeTagArray(
            rawTags.occasions ||
            rawTags.occasion
        );

    const vibes =
        normalizeTagArray(
            rawTags.vibes ||
            rawTags.vibe
        );

    return {
        ...item,
        tags: {
            ...rawTags,
            brand: rawTags.brand || "",
            category: rawTags.category || "Other",
            subcategory: rawTags.subcategory || null,
            season,
            occasions,
            palette: rawTags.palette || "Monochrome",
            vibes,
            layerable: Boolean(rawTags.layerable)
        }
    };
}

function getCategoryLabel(tags) {

    if (tags?.subcategory) {
        return tags.subcategory;
    }

    return CATEGORY_LABELS[tags?.category] ||
        tags?.category ||
        "Other";
}

function getItemBadgeList(tags) {

    const badges = [];

    if (tags.season) {
        badges.push(tags.season);
    }

    if (tags.palette) {
        badges.push(tags.palette);
    }

    if (tags.occasions?.length) {
        badges.push(tags.occasions[0]);
    }

    if (tags.vibes?.length) {
        badges.push(tags.vibes[0]);
    }

    return badges.slice(0, 4);
}

function renderTagGroupHTML({
    group,
    context,
    activeValue,
    activeValues,
    includeAll = false
}) {

    const options = includeAll
        ? ["ALL", ...group.options]
        : group.options;

    return `
        <div class="tag-section">
            <div class="section-label">${escapeHtml(group.label)}</div>
            <div class="tag-grid mt-4">
                ${options.map((option) => {
                    const isActive = includeAll
                        ? activeValue === option
                        : group.multi
                            ? activeValues.includes(option)
                            : activeValue === option;

                    const label =
                        option === "ALL"
                            ? `Any ${group.label}`
                            : option;

                    return `
                        <button
                            class="chip tag-chip ${isActive ? "active" : ""}"
                            type="button"
                            data-context="${context}"
                            data-group="${group.id}"
                            data-value="${escapeHtml(option)}"
                            aria-pressed="${String(isActive)}"
                        >
                            ${escapeHtml(label)}
                        </button>
                    `;
                }).join("")}
            </div>
        </div>
    `;
}

function renderFormTagGroups() {

    const container =
        document.getElementById("item-tag-groups");

    if (!container) return;

    container.innerHTML =
        FORM_TAG_GROUPS.map((group) =>
            renderTagGroupHTML({
                group,
                context: "form",
                activeValue: formState[group.id],
                activeValues: formState[group.id] || []
            })
        ).join("");
}

function renderSelectionSummary() {

    const summary =
        document.getElementById("selection-summary");

    if (!summary) return;

    const pills = [
        getCategoryLabel(formState),
        formState.season,
        formState.palette,
        ...formState.occasions,
        ...formState.vibes
    ].filter(Boolean);

    summary.innerHTML = pills.map((pill) => `
        <span class="summary-pill">${escapeHtml(toReadableLabel(pill))}</span>
    `).join("");
}

function renderCategoryButtons() {

    document.querySelectorAll(".cat-opt")
        .forEach((button) => {

            const isActive =
                button.dataset.val === formState.category
                &&
                (button.dataset.sub || null) === formState.subcategory;

            button.classList.toggle(
                "active",
                isActive
            );

            button.setAttribute(
                "aria-pressed",
                String(isActive)
            );
        });
}

function setFormFeedback(message, type = "info") {

    const feedback =
        document.getElementById("form-feedback");

    if (!feedback) return;

    feedback.textContent =
        message || "";

    feedback.className =
        `status-line mt-4 ${message ? `status-${type}` : ""}`;
}

function updateCollectionStatus(message) {

    const status =
        document.getElementById("collection-status");

    if (!status) return;

    status.textContent =
        message;
}

function updateSaveButtonState() {

    const button =
        document.getElementById("save-btn");

    const nameInput =
        document.getElementById("item-name");

    if (!button) return;

    if (isSaving) {
        button.disabled = true;
        button.textContent = editingItemId
            ? "Saving..."
            : "Archiving...";
        return;
    }

    const ready =
        Boolean(currentImageData || editingImageUrl) &&
        Boolean(nameInput?.value.trim());

    button.disabled = !ready;
    button.textContent = ready
        ? (editingItemId
            ? "Save Changes"
            : "Archive Item")
        : "Image + Name Required";
}

function updateUploadPreview() {

    const preview =
        document.getElementById("preview-img");

    const dropText =
        document.getElementById("drop-text");

    const uploadMeta =
        document.getElementById("upload-meta");

    const removeButton =
        document.getElementById("remove-image-btn");

    const previewSource =
        currentImageData || editingImageUrl;

    if (preview) {
        if (previewSource) {
            preview.src = previewSource;
            preview.classList.remove("hidden");
        } else {
            preview.src = "";
            preview.classList.add("hidden");
        }
    }

    if (dropText) {
        dropText.classList.toggle(
            "hidden",
            Boolean(previewSource)
        );
    }

    if (uploadMeta) {
        if (currentImageData) {
            uploadMeta.textContent = "Replacement preview ready";
        } else if (editingImageUrl) {
            uploadMeta.textContent = "Current image loaded";
        } else {
            uploadMeta.textContent = "JPEG, PNG, WEBP";
        }
    }

    if (removeButton) {
        removeButton.classList.toggle(
            "hidden",
            !previewSource
        );
    }
}

function resetForm({ keepFeedback = false } = {}) {

    formState = getDefaultFormState();
    currentImageData = null;
    editingItemId = null;
    editingImageUrl = null;

    const fileInput =
        document.getElementById("file-input");

    const nameInput =
        document.getElementById("item-name");

    const brandInput =
        document.getElementById("item-brand");

    if (fileInput) {
        fileInput.value = "";
    }

    if (nameInput) {
        nameInput.value = "";
    }

    if (brandInput) {
        brandInput.value = "";
    }

    renderFormTagGroups();
    renderCategoryButtons();
    renderSelectionSummary();
    updateUploadPreview();
    updateSaveButtonState();

    if (!keepFeedback) {
        setFormFeedback(
            "Add an image and a name, then build out the tags.",
            "info"
        );
    }
}

function renderEmptyState(itemCount) {

    const emptyState =
        document.getElementById("catalog-empty");

    const emptyCopy =
        document.getElementById("catalog-empty-copy");

    if (!emptyState || !emptyCopy) return;

    if (itemCount > 0) {
        emptyState.classList.add("hidden");
        return;
    }

    emptyCopy.textContent =
        "Your archive is still empty. Add a first piece and start building a more useful wardrobe map.";

    emptyState.classList.remove("hidden");
}

function renderCatalog() {

    const items = allItems;

    const countEl =
        document.getElementById("item-count");

    const grid =
        document.getElementById("catalog-grid");

    if (countEl) {
        countEl.innerText =
            items.length
                .toString()
                .padStart(2, "0")
            + " ITEMS";
    }

    if (!grid) return;

    updateCollectionStatus(
        items.length > 0
            ? `Showing ${items.length} archived piece${items.length === 1 ? "" : "s"}. Click Edit on any card to update it.`
            : "No archived items yet."
    );

    renderEmptyState(items.length);

    if (!items.length) {
        grid.innerHTML = "";
        return;
    }

    grid.innerHTML =
        items.map((item) => {

            const badges =
                getItemBadgeList(item.tags);

            return `
                <article class="item-card">
                    <div class="img-container">
                        <img
                            src="${escapeHtml(item.image_url)}"
                            loading="lazy"
                            alt="${escapeHtml(item.name)}"
                        >
                    </div>

                    <div class="mt-5">
                        <p class="item-name text-[11px] font-medium uppercase tracking-widest">
                            ${escapeHtml(item.name)}
                        </p>

                        <p class="item-meta text-[9px] uppercase tracking-[0.15em] mt-1">
                            ${escapeHtml(item.tags.brand || "Independent")}
                            &bull;
                            ${escapeHtml(getCategoryLabel(item.tags))}
                        </p>

                        <div class="item-badges mt-4">
                            ${badges.map((badge) => `
                                <span class="item-badge">${escapeHtml(toReadableLabel(badge))}</span>
                            `).join("")}
                        </div>

                        <div class="mt-5">
                            <button
                                class="secondary-btn text-[10px] tracking-[0.2em] uppercase edit-item-btn"
                                type="button"
                                data-item-id="${escapeHtml(item.id)}"
                            >
                                Edit
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join("");
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
                    ${escapeHtml(line.replace("## ", ""))}
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
                    ${escapeHtml(line.replace("### ", ""))}
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

            const clean = escapeHtml(
                line.replace(/^[-*]\s/, "")
            ).replace(
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
                    ${escapeHtml(line.replace("> ", ""))}
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
                ${escapeHtml(line).replace(
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

    return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ========================================
// FILE HANDLING
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

async function handleIncomingFile(file) {

    if (!file?.type?.startsWith("image/")) {
        setFormFeedback(
            "Use an image file for the archive preview.",
            "error"
        );
        return;
    }

    const compressedDataUrl =
        await compressImage(
            file,
            900,
            0.75
        );

    currentImageData =
        compressedDataUrl;

    updateUploadPreview();
    updateSaveButtonState();
    setFormFeedback(
        "Image ready. Add the details that will make this piece searchable later.",
        "success"
    );
}

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
// DATA
// ========================================

async function fetchItems() {

    const { data, error } = await supabase
        .from("items")
        .select("id,name,image_url,tags")
        .order("id", { ascending: false });

    if (error) {
        console.error(error);
        updateCollectionStatus(
            "The collection could not be loaded right now."
        );
        return;
    }

    allItems =
        (data || []).map(normalizeItem);

    renderCatalog();
}

function beginEditingItem(itemId) {

    const item =
        allItems.find((entry) =>
            String(entry.id) === String(itemId)
        );

    if (!item) {
        setFormFeedback(
            "That item could not be loaded for editing.",
            "error"
        );
        return;
    }

    editingItemId = item.id;
    editingImageUrl = item.image_url;
    currentImageData = null;

    formState = {
        category: item.tags.category || "Other",
        subcategory: item.tags.subcategory || null,
        season: item.tags.season || "All-season",
        occasions: item.tags.occasions?.length
            ? item.tags.occasions
            : ["Everyday"],
        palette: item.tags.palette || "Monochrome",
        vibes: item.tags.vibes?.length
            ? item.tags.vibes
            : ["Minimal"]
    };

    const nameInput =
        document.getElementById("item-name");

    const brandInput =
        document.getElementById("item-brand");

    if (nameInput) {
        nameInput.value = item.name || "";
    }

    if (brandInput) {
        brandInput.value =
            item.tags.brand || "";
    }

    renderFormTagGroups();
    renderCategoryButtons();
    renderSelectionSummary();
    updateUploadPreview();
    updateSaveButtonState();
    setFormFeedback(
        `Editing "${item.name}". Save changes when you are done, or press Reset to exit edit mode.`,
        "info"
    );

    document.getElementById("item-name")
        ?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
}

function buildItemPayload() {

    const nameInput =
        document.getElementById("item-name");

    const brandInput =
        document.getElementById("item-brand");

    return {
        name: nameInput?.value.trim() || "",
        tags: {
            brand: brandInput?.value.trim() || "",
            category: formState.category,
            subcategory: formState.subcategory,
            layerable: formState.subcategory === "Top",
            season: formState.season,
            occasions: formState.occasions,
            palette: formState.palette,
            vibes: formState.vibes
        }
    };
}

async function saveItem() {

    const { data: { session } } =
        await supabase.auth.getSession();

    const payload =
        buildItemPayload();

    if (!(currentImageData || editingImageUrl) || !payload.name) {
        setFormFeedback(
            "An image and item name are required before saving.",
            "error"
        );
        return;
    }

    isSaving = true;
    updateSaveButtonState();
    setFormFeedback(
        editingItemId
            ? "Saving your changes..."
            : "Uploading and archiving your item...",
        "info"
    );

    try {

        let imageUrl =
            editingImageUrl;

        if (currentImageData) {
            imageUrl =
                await uploadImageToStorage(
                    currentImageData
                );
        }

        let error = null;

        if (editingItemId) {
            const updateResult =
                await supabase
                    .from("items")
                    .update({
                        name: payload.name,
                        image_url: imageUrl,
                        tags: payload.tags
                    })
                    .eq("id", editingItemId);

            error = updateResult.error;
        } else {
            const insertResult =
                await supabase
                    .from("items")
                    .insert([{
                        user_id:
                            session?.user?.id || null,
                        name: payload.name,
                        image_url: imageUrl,
                        tags: payload.tags
                    }]);

            error = insertResult.error;
        }

        if (error) {
            throw error;
        }

        setFormFeedback(
            editingItemId
                ? "Changes saved. The archive has been updated."
                : "Archived. It has been added to the collection below.",
            "success"
        );

        resetForm({ keepFeedback: true });
        await fetchItems();

    } catch (err) {

        console.error(err);

        setFormFeedback(
            `Archive failed: ${err.message}`,
            "error"
        );

    } finally {
        isSaving = false;
        updateSaveButtonState();
    }
}

// ========================================
// AI CONSULT
// ========================================

function buildWardrobeContext(items) {

    if (!items.length) {
        return "The user's archive is currently empty.";
    }

    return items.map((item) => {

        const contextParts = [
            item.tags.brand || "Independent",
            getCategoryLabel(item.tags),
            item.tags.season,
            item.tags.palette
        ];

        if (item.tags.occasions.length) {
            contextParts.push(
                `occasion: ${item.tags.occasions.join(", ")}`
            );
        }

        if (item.tags.vibes.length) {
            contextParts.push(
                `vibe: ${item.tags.vibes.join(", ")}`
            );
        }

        return `- ${item.name} (${contextParts.join("; ")})`;
    }).join("\n");
}

async function runConsultation() {

    const askBtn =
        document.getElementById("ask-btn");

    const suggestionBox =
        document.getElementById("ai-suggestion");

    const promptEl =
        document.getElementById("occasion-input");

    const userPrompt =
        (promptEl?.value || "").trim();

    if (!userPrompt) {
        alert(
            "Please enter a question for the consultant."
        );
        return;
    }

    if (askBtn) {
        askBtn.disabled = true;
        askBtn.innerText = "Consulting...";
    }

    try {

        const { data, error } =
            await supabase
                .from("items")
                .select("name,tags");

        if (error) {
            throw error;
        }

        const wardrobeContext =
            buildWardrobeContext(
                (data || []).map(normalizeItem)
            );

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
        if (askBtn) {
            askBtn.innerText =
                "Consult Archive";
            askBtn.disabled = false;
        }
    }
}

// ========================================
// DOM READY
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    setupThemePicker();
    renderFormTagGroups();
    renderSelectionSummary();
    renderCategoryButtons();
    updateUploadPreview();
    resetForm();
    fetchItems();

    const authBtn =
        document.getElementById("auth-btn");

    const keyInput =
        document.getElementById("user-api-key");

    const modelSelect =
        document.getElementById("model-select");

    const fileInput =
        document.getElementById("file-input");

    const dropZone =
        document.getElementById("drop-zone");

    const removeImageBtn =
        document.getElementById("remove-image-btn");

    const saveBtn =
        document.getElementById("save-btn");

    const clearFormBtn =
        document.getElementById("clear-form-btn");

    const occasionInput =
        document.getElementById("occasion-input");

    const askBtn =
        document.getElementById("ask-btn");

    const nameInput =
        document.getElementById("item-name");

    if (authBtn) {
        authBtn.onclick = async () => {

            const { data: { session } } =
                await supabase.auth.getSession();

            if (session) {
                await supabase.auth.signOut();
                window.location.reload();
                return;
            }

            await supabase.auth.signInWithOAuth({
                provider: "discord",
                options: {
                    redirectTo: REDIRECT_URL
                }
            });
        };
    }

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

        } else if (authBtn) {
            authBtn.innerText = "CONNECT";
        }

        fetchItems();
    });

    document.addEventListener("click", (event) => {

        const formChip =
            event.target.closest(
                "[data-context='form']"
            );

        if (formChip) {

            const groupId =
                formChip.dataset.group;

            const config =
                FORM_TAG_GROUPS.find(
                    (group) => group.id === groupId
                );

            if (!config) return;

            const value =
                formChip.dataset.value;

            if (config.multi) {

                const nextValues =
                    formState[groupId].includes(value)
                        ? formState[groupId].filter(
                            (entry) => entry !== value
                        )
                        : [...formState[groupId], value];

                formState[groupId] = nextValues;

            } else {
                formState[groupId] = value;
            }

            renderFormTagGroups();
            renderSelectionSummary();
            return;
        }

        const categoryButton =
            event.target.closest(".cat-opt");

        if (categoryButton) {
            formState.category =
                categoryButton.dataset.val;
            formState.subcategory =
                categoryButton.dataset.sub || null;

            renderCategoryButtons();
            renderSelectionSummary();
            return;
        }

        const editButton =
            event.target.closest(".edit-item-btn");

        if (editButton) {
            beginEditingItem(
                editButton.dataset.itemId
            );
        }
    });

    if (nameInput) {
        nameInput.addEventListener(
            "input",
            updateSaveButtonState
        );
    }

    document.getElementById("item-brand")
        ?.addEventListener("input", () => {
            setFormFeedback(
                "Metadata updates here will improve search and styling suggestions later.",
                "info"
            );
        });

    if (fileInput) {
        fileInput.onchange = async (event) => {
            const file =
                event.target.files[0];

            if (file) {
                await handleIncomingFile(file);
            }
        };
    }

    if (dropZone) {
        dropZone.onclick = () => {
            fileInput?.click();
        };

        dropZone.onkeydown = (event) => {
            if (
                event.key === "Enter" ||
                event.key === " "
            ) {
                event.preventDefault();
                fileInput?.click();
            }
        };

        ["dragenter", "dragover"].forEach((type) => {
            dropZone.addEventListener(type, (event) => {
                event.preventDefault();
                dropZone.classList.add("dragging");
            });
        });

        ["dragleave", "dragend", "drop"].forEach((type) => {
            dropZone.addEventListener(type, (event) => {
                event.preventDefault();
                dropZone.classList.remove("dragging");
            });
        });

        dropZone.addEventListener("drop", async (event) => {
            const file =
                event.dataTransfer?.files?.[0];

            if (file) {
                await handleIncomingFile(file);
            }
        });
    }

    if (removeImageBtn) {
        removeImageBtn.onclick = (event) => {
            event.stopPropagation();
            currentImageData = null;
            if (fileInput) {
                fileInput.value = "";
            }
            updateUploadPreview();
            updateSaveButtonState();
            setFormFeedback(
                "Image removed. Drop in a new one when you are ready.",
                "info"
            );
        };
    }

    if (clearFormBtn) {
        clearFormBtn.onclick = () => {
            resetForm();
        };
    }

    if (saveBtn) {
        saveBtn.onclick = async () => {
            await saveItem();
        };
    }

    if (occasionInput) {
        occasionInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                runConsultation();
            }
        });
    }

    if (askBtn) {
        askBtn.onclick = async () => {
            await runConsultation();
        };
    }
});
