const SUPABASE_URL = "https://wyvliczohxpyptwxnvfi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5";
const REDIRECT_URL = "https://donutgames113.github.io/Curato/index.html";
const THEME_STORAGE_KEY = "curato-theme";
const AVAILABLE_THEMES = ["dark", "light", "dune", "slate"];

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

const COLLECTION_FILTER_GROUPS = [
    {
        id: "season",
        label: "Season",
        options: ["All-season", "Spring", "Summer", "Autumn", "Winter"]
    },
    {
        id: "occasions",
        label: "Occasion",
        options: ["Everyday", "Work", "Evening", "Travel", "Formal"]
    },
    {
        id: "palette",
        label: "Palette",
        options: ["Monochrome", "Earth", "Warm", "Cool", "Accent"]
    },
    {
        id: "vibes",
        label: "Vibe",
        options: ["Minimal", "Tailored", "Relaxed", "Technical", "Statement"]
    }
];

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let currentImageData = null;
let allItems = [];
let isSaving = false;
let currentSortClass = "ALL";

let formState = getDefaultFormState();
let collectionFilters = getDefaultCollectionFilters();

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

function getDefaultCollectionFilters() {
    return {
        search: "",
        season: "ALL",
        occasions: "ALL",
        palette: "ALL",
        vibes: "ALL"
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
            notes: rawTags.notes || "",
            layerable: Boolean(rawTags.layerable)
        }
    };
}

function getCategoryLabel(tags) {

    if (tags?.subcategory) {
        return tags.subcategory;
    }

    if (tags?.category === "Fragrance") {
        return "Scent";
    }

    return tags?.category || "Other";
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

function renderCollectionFilterGroups() {

    const container =
        document.getElementById("collection-filter-groups");

    if (!container) return;

    container.innerHTML =
        COLLECTION_FILTER_GROUPS.map((group) =>
            renderTagGroupHTML({
                group,
                context: "filter",
                activeValue: collectionFilters[group.id],
                activeValues: [],
                includeAll: true
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

function renderActiveFilters() {

    const container =
        document.getElementById("active-filter-pills");

    if (!container) return;

    const active = [];

    if (currentSortClass !== "ALL") {
        active.push(currentSortClass === "Fragrance"
            ? "Scent"
            : currentSortClass);
    }

    if (collectionFilters.search) {
        active.push(`Search: ${collectionFilters.search}`);
    }

    COLLECTION_FILTER_GROUPS.forEach((group) => {
        const value =
            collectionFilters[group.id];

        if (value && value !== "ALL") {
            active.push(value);
        }
    });

    container.innerHTML = active.length
        ? active.map((pill) => `
            <span class="summary-pill filter-pill">${escapeHtml(toReadableLabel(pill))}</span>
        `).join("")
        : `<span class="helper-text">No collection filters active. You are seeing the whole archive.</span>`;
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

function renderCollectionCategoryButtons() {

    document.querySelectorAll(".sort-opt")
        .forEach((button) => {

            const isActive =
                button.dataset.sort === currentSortClass;

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
        button.textContent = "Archiving...";
        return;
    }

    const ready =
        Boolean(currentImageData) &&
        Boolean(nameInput?.value.trim());

    button.disabled = !ready;
    button.textContent = ready
        ? "Archive Item"
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

    if (preview) {
        if (currentImageData) {
            preview.src = currentImageData;
            preview.classList.remove("hidden");
        } else {
            preview.src = "";
            preview.classList.add("hidden");
        }
    }

    if (dropText) {
        dropText.classList.toggle(
            "hidden",
            Boolean(currentImageData)
        );
    }

    if (uploadMeta) {
        uploadMeta.textContent = currentImageData
            ? "Preview ready"
            : "JPEG, PNG, WEBP";
    }

    if (removeButton) {
        removeButton.classList.toggle(
            "hidden",
            !currentImageData
        );
    }
}

function resetForm({ keepFeedback = false } = {}) {

    formState = getDefaultFormState();
    currentImageData = null;

    const fileInput =
        document.getElementById("file-input");

    const nameInput =
        document.getElementById("item-name");

    const brandInput =
        document.getElementById("item-brand");

    const notesInput =
        document.getElementById("item-notes");

    if (fileInput) {
        fileInput.value = "";
    }

    if (nameInput) {
        nameInput.value = "";
    }

    if (brandInput) {
        brandInput.value = "";
    }

    if (notesInput) {
        notesInput.value = "";
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

function resetCollectionFilters() {

    collectionFilters =
        getDefaultCollectionFilters();

    currentSortClass = "ALL";

    const searchInput =
        document.getElementById("catalog-search");

    if (searchInput) {
        searchInput.value = "";
    }

    renderCollectionCategoryButtons();
    renderCollectionFilterGroups();
    renderActiveFilters();
    renderCatalog();
}

function itemMatchesSearch(item, query) {

    const haystack = [
        item.name,
        item.tags.brand,
        item.tags.category,
        item.tags.subcategory,
        item.tags.season,
        item.tags.palette,
        item.tags.notes,
        ...(item.tags.occasions || []),
        ...(item.tags.vibes || [])
    ].join(" ").toLowerCase();

    return haystack.includes(
        query.toLowerCase()
    );
}

function itemMatchesCollectionFilters(item) {

    if (currentSortClass === "TOPS" &&
        item.tags.subcategory !== "Top") {
        return false;
    }

    if (currentSortClass === "BOTTOMS" &&
        item.tags.subcategory !== "Bottom") {
        return false;
    }

    if (
        currentSortClass !== "ALL" &&
        currentSortClass !== "TOPS" &&
        currentSortClass !== "BOTTOMS" &&
        item.tags.category !== currentSortClass
    ) {
        return false;
    }

    if (
        collectionFilters.search &&
        !itemMatchesSearch(
            item,
            collectionFilters.search
        )
    ) {
        return false;
    }

    if (
        collectionFilters.season !== "ALL" &&
        item.tags.season !== collectionFilters.season
    ) {
        return false;
    }

    if (
        collectionFilters.occasions !== "ALL" &&
        !item.tags.occasions.includes(
            collectionFilters.occasions
        )
    ) {
        return false;
    }

    if (
        collectionFilters.palette !== "ALL" &&
        item.tags.palette !== collectionFilters.palette
    ) {
        return false;
    }

    if (
        collectionFilters.vibes !== "ALL" &&
        !item.tags.vibes.includes(
            collectionFilters.vibes
        )
    ) {
        return false;
    }

    return true;
}

function getFilteredItems() {

    return allItems.filter(
        itemMatchesCollectionFilters
    );
}

function renderEmptyState(filteredCount) {

    const emptyState =
        document.getElementById("catalog-empty");

    const emptyCopy =
        document.getElementById("catalog-empty-copy");

    if (!emptyState || !emptyCopy) return;

    if (filteredCount > 0) {
        emptyState.classList.add("hidden");
        return;
    }

    const hasAnyFilters =
        currentSortClass !== "ALL" ||
        Boolean(collectionFilters.search) ||
        Object.values(collectionFilters)
            .some((value) =>
                value !== "" &&
                value !== "ALL"
            );

    emptyCopy.textContent = hasAnyFilters
        ? "Nothing matches this combination yet. Try clearing a filter or broadening the search."
        : "Your archive is still empty. Add a first piece and start building a more useful wardrobe map.";

    emptyState.classList.remove("hidden");
}

function renderCatalog() {

    const filtered =
        getFilteredItems();

    const countEl =
        document.getElementById("item-count");

    const grid =
        document.getElementById("catalog-grid");

    if (countEl) {
        countEl.innerText =
            filtered.length
                .toString()
                .padStart(2, "0")
            + " ITEMS";
    }

    if (!grid) return;

    updateCollectionStatus(
        filtered.length > 0
            ? `Showing ${filtered.length} piece${filtered.length === 1 ? "" : "s"} with the current filters.`
            : "No results in the current slice."
    );

    renderActiveFilters();
    renderEmptyState(filtered.length);

    if (!filtered.length) {
        grid.innerHTML = "";
        return;
    }

    grid.innerHTML =
        filtered.map((item) => {

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

                        ${item.tags.notes
                            ? `<p class="item-note mt-4">${escapeHtml(item.tags.notes)}</p>`
                            : ""}
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

function buildItemPayload() {

    const nameInput =
        document.getElementById("item-name");

    const brandInput =
        document.getElementById("item-brand");

    const notesInput =
        document.getElementById("item-notes");

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
            vibes: formState.vibes,
            notes: notesInput?.value.trim() || ""
        }
    };
}

async function saveItem() {

    const { data: { session } } =
        await supabase.auth.getSession();

    const payload =
        buildItemPayload();

    if (!currentImageData || !payload.name) {
        setFormFeedback(
            "An image and item name are required before archiving.",
            "error"
        );
        return;
    }

    isSaving = true;
    updateSaveButtonState();
    setFormFeedback(
        "Uploading and archiving your item...",
        "info"
    );

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
                    name: payload.name,
                    image_url: imageUrl,
                    tags: payload.tags
                }]);

        if (error) {
            throw error;
        }

        setFormFeedback(
            "Archived. It has been added to the collection below.",
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

        if (item.tags.notes) {
            contextParts.push(
                `notes: ${item.tags.notes}`
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
    renderCollectionFilterGroups();
    renderSelectionSummary();
    renderCategoryButtons();
    renderCollectionCategoryButtons();
    renderActiveFilters();
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

    const clearFiltersBtn =
        document.getElementById("clear-filters-btn");

    const searchInput =
        document.getElementById("catalog-search");

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

        const filterChip =
            event.target.closest(
                "[data-context='filter']"
            );

        if (filterChip) {
            const groupId =
                filterChip.dataset.group;

            collectionFilters[groupId] =
                filterChip.dataset.value;

            renderCollectionFilterGroups();
            renderCatalog();
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

        const sortButton =
            event.target.closest(".sort-opt");

        if (sortButton) {
            currentSortClass =
                sortButton.dataset.sort;

            renderCollectionCategoryButtons();
            renderCatalog();
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

    document.getElementById("item-notes")
        ?.addEventListener("input", () => {
            setFormFeedback(
                "Notes are searchable, so small details pay off later.",
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

    if (clearFiltersBtn) {
        clearFiltersBtn.onclick = () => {
            resetCollectionFilters();
        };
    }

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            collectionFilters.search =
                searchInput.value.trim();
            renderCatalog();
        });
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
