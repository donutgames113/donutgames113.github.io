const SUPABASE_URL = 'https://wyvliczohxpyptwxnvfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_02EIiOlUVbNn5Lpn5cQWww_UF_uq9E5';
const REDIRECT_URL = 'https://donutgames113.github.io/Curato/index.html';
const UI_STYLES = new Set(['curato', 'flat', 'frutiger', 'liquid', 'retro', 'brutalist', 'editorial']);

const promptModes = {
    outfit: {
        placeholder: "Where are we going?",
        ariaLabel: "Describe the occasion you need an outfit for",
        instruction: `Create one considered, head-to-toe outfit using the most suitable archive pieces. Make clear recommendations rather than listing interchangeable options. Explain briefly why the key pieces work together and how to wear them. Account for the occasion, dress code, season, time, and weather when provided; include only relevant shoes and accessories. For clothing layers, ignore any stored "layerable" flag: decide from the actual item type, cut, fabric, thickness, and likely fit. Build a practical base-to-outer sequence (for example, tee or shirt under knit or overshirt under coat) only when the pieces can physically sit comfortably together. Avoid competing bulky layers, incompatible necklines or lengths, and layering delicate or structured pieces in ways that could distort or damage them. Do not treat every top as a layering piece; if a layer will not improve warmth, function, or the look, leave it out. Mention a useful missing layer only as a clearly labelled suggestion outside the archive.`,
        examples: [
            ["fa-plane-departure", "Tokyo solo trip", "An outfit for a Tokyo solo trip"],
            ["fa-sun", "Meeting the family", "An outfit for meeting the family"],
            ["fa-moon", "Late night in Soho", "An outfit for a late night in Soho"]
        ]
    },
    item: {
        placeholder: "What piece do you want to style?",
        ariaLabel: "Describe the piece you want help styling",
        instruction: `Make the specific archived piece the user names or describes the anchor of the answer. Give practical styling guidance for that piece (silhouette, colour, proportion, occasion, and suitable clothing layers where relevant), then recommend complementary archive pieces only when useful. Ignore any stored "layerable" flag and judge layering from garment type, cut, fabric, thickness, and fit; never force a layer that would be bulky, restrictive, or damaging. Build a complete outfit only if it helps answer the request. Respect a request about just one item or category, and do not substitute a different archive piece for the one requested.`,
        examples: [
            ["fa-shoe-prints", "Style these shoes", "How should I style my loafers?"],
            ["fa-shirt", "Build around a jacket", "Build a look around my leather jacket"],
            ["fa-spray-can-sparkles", "Pick a fragrance", "Which fragrance suits a summer evening?"]
        ]
    },
    wardrobe: {
        placeholder: "Ask about your wardrobe",
        ariaLabel: "Ask a question about your wardrobe",
        instruction: `Answer the wardrobe question directly using archive facts: counts, comparisons, brands, prices if present, wardrobe gaps, care, or organization as relevant. Distinguish known details from cautious inferences, and never invent missing information. Do not turn the answer into an outfit or layering recommendation unless the user specifically asks for styling advice.`,
        examples: [
            ["fa-chart-pie", "Find wardrobe gaps", "What is missing from my wardrobe?"],
            ["fa-tags", "Compare my pieces", "Which of my jackets is most versatile?"],
            ["fa-box-archive", "Organize my archive", "How should I organize my wardrobe?"]
        ]
    },
    packing: {
        placeholder: "Where are you travelling?",
        ariaLabel: "Describe your trip and packing needs",
        instruction: `Produce a practical packing list for the stated destination, trip length, activities, season, and weather. Group items by useful categories and suggest quantities only when the trip details support them. Prioritize suitable archive items and rewearable combinations. Treat layers as functional choices for expected conditions: recommend only garments that can comfortably layer together based on their type, cut, fabric, thickness, and fit, and ignore any stored "layerable" flag. Avoid redundant or impractical layers. Clearly separate archive items from useful items the user does not own; never present an unowned item as part of the archive.`,
        examples: [
            ["fa-suitcase", "Weekend city break", "Pack my archive for a weekend in Paris"],
            ["fa-umbrella", "Warm-weather escape", "What should I pack for five days in Lisbon?"],
            ["fa-mountain-sun", "Outdoor getaway", "Build a packing list for a week hiking in the Alps"]
        ]
    },
    general: {
        placeholder: "Ask Curato anything about style",
        ariaLabel: "Ask Curato a general fashion or style question",
        instruction: `Answer the fashion, style, or clothing question directly with clear, useful advice. Use the archive only when it materially helps answer the question; do not default to an outfit, packing list, or wardrobe audit. Give layering advice only when relevant, judging whether pieces work together from garment type, cut, fabric, thickness, and fit rather than any stored "layerable" flag. General recommendations beyond the archive are allowed when useful, but clearly distinguish them from items the user owns.`,
        examples: [
            ["fa-palette", "Understand colour", "What colours work well with olive green?"],
            ["fa-ruler-combined", "Improve the fit", "How should a blazer fit at the shoulders?"],
            ["fa-shirt", "Decode a dress code", "What does smart casual mean for a dinner?"]
        ]
    }
};

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let selectedCategory = "Other";
let selectedSubCategory = null;
let currentImageData = null;
let currentSortClass = "ALL";
let searchQuery = "";
let latestSuggestion = null;
let favoriteOutfits = [];
let consultationItems = [];
let wardrobeItems = [];
let inspireWishlist = [];
let inspireOffset = 0;
let selectedWardrobeItems = new Set();
let wardrobeSelectionMode = false;
let nextItemReference = 1;
let editingItemId = null;
let editingImageData = null;
let brandIconSource = null;

function recolorBrandIcon() {
    const canvas = document.getElementById('brand-icon');
    if (!canvas || !brandIconSource) return false;

    const context = canvas.getContext('2d');
    if (!context) {
        console.error('Unable to render the Curato brand icon: canvas is unavailable.');
        return false;
    }

    const imageData = context.createImageData(brandIconSource.width, brandIconSource.height);
    imageData.data.set(brandIconSource.data);
    if (document.body.dataset.colorTheme !== 'violet') {
        const styles = getComputedStyle(document.body);
        const primary = styles.getPropertyValue('--logo-primary').trim();
        const secondary = styles.getPropertyValue('--logo-secondary').trim();
        const primaryRgb = primary.match(/^#([\da-f]{6})$/i);
        const secondaryRgb = secondary.match(/^#([\da-f]{6})$/i);
        if (!primaryRgb || !secondaryRgb) {
            console.error('Unable to recolor the Curato brand icon: theme colors must be six-digit hex values.');
            return false;
        }

        const parseRgb = match => [
            parseInt(match[1].slice(0, 2), 16),
            parseInt(match[1].slice(2, 4), 16),
            parseInt(match[1].slice(4, 6), 16)
        ];
        const primaryColor = parseRgb(primaryRgb);
        const secondaryColor = parseRgb(secondaryRgb);
        const violetSource = [116, 85, 244];
        const yellowSource = [239, 205, 100];
        const pixels = imageData.data;

        for (let index = 0; index < pixels.length; index += 4) {
            if (pixels[index + 3] === 0) continue;

            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            if (Math.min(red, green, blue) > 235 && Math.max(red, green, blue) - Math.min(red, green, blue) < 16) continue;

            const violetDistance = (red - violetSource[0]) ** 2 + (green - violetSource[1]) ** 2 + (blue - violetSource[2]) ** 2;
            const yellowDistance = (red - yellowSource[0]) ** 2 + (green - yellowSource[1]) ** 2 + (blue - yellowSource[2]) ** 2;
            const color = violetDistance <= yellowDistance ? primaryColor : secondaryColor;
            pixels[index] = color[0];
            pixels[index + 1] = color[1];
            pixels[index + 2] = color[2];
        }
    }

    context.putImageData(imageData, 0, 0);
    return true;
}

function initializeBrandIcon() {
    const canvas = document.getElementById('brand-icon');
    const fallback = document.getElementById('brand-icon-fallback');
    if (!canvas || !fallback) return;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
        console.error('Unable to load the Curato brand icon: canvas is unavailable.');
        return;
    }

    const image = new Image();
    image.addEventListener('load', () => {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        context.drawImage(image, 0, 0);
        brandIconSource = context.getImageData(0, 0, canvas.width, canvas.height);
        if (recolorBrandIcon()) {
            canvas.classList.remove('hidden');
            fallback.classList.add('hidden');
        }
    });
    image.addEventListener('error', () => {
        console.error('Unable to load the Curato brand icon image.');
    });
    image.src = new URL('./IconTransparent.png', import.meta.url).href;
}

function applyTheme(
    theme,
    colorTheme = localStorage.getItem('curato-color-theme') || 'violet',
    uiStyle = localStorage.getItem('curato-ui-style') || 'curato'
) {
    const isDark = theme === 'dark';
    const selectedUiStyle = UI_STYLES.has(uiStyle) ? uiStyle : 'curato';
    document.body.classList.toggle('dark-mode', isDark);
    document.body.dataset.colorTheme = colorTheme;
    document.body.dataset.uiStyle = selectedUiStyle;
    recolorBrandIcon();
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        toggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
        const modeLabel = toggle.querySelector('#theme-mode-label');
        if (modeLabel) modeLabel.textContent = isDark ? 'Dark mode' : 'Light mode';
    }
    document.querySelectorAll('#palette-modal [data-color-theme]').forEach(option => {
        option.setAttribute('aria-pressed', String(option.dataset.colorTheme === colorTheme));
    });
    document.querySelectorAll('#palette-modal [data-ui-style]').forEach(option => {
        option.setAttribute('aria-pressed', String(option.dataset.uiStyle === selectedUiStyle));
    });
    const styleLabel = document.querySelector(`#palette-modal [data-ui-style="${selectedUiStyle}"] .style-choice-name`);
    const styleModeLabel = document.getElementById('style-mode-label');
    if (styleLabel && styleModeLabel) styleModeLabel.textContent = styleLabel.textContent;
}

function initializeTheme() {
    initializeBrandIcon();
    const savedTheme = localStorage.getItem('curato-theme');
    const savedColorTheme = localStorage.getItem('curato-color-theme') || 'violet';
    const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (systemPrefersDark ? 'dark' : 'light'), savedColorTheme);
    const paletteToggle = document.getElementById('palette-toggle');
    const paletteModal = document.getElementById('palette-modal');
    const closePalette = () => {
        paletteModal?.classList.add('hidden');
        paletteModal?.classList.remove('flex');
        paletteToggle?.focus();
    };

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('curato-theme', nextTheme);
        applyTheme(nextTheme, document.body.dataset.colorTheme);
    });
    paletteToggle?.addEventListener('click', () => {
        paletteModal?.classList.remove('hidden');
        paletteModal?.classList.add('flex');
        paletteModal?.querySelector('#style-picker-summary')?.focus();
    });
    document.querySelectorAll('[data-close-palette]').forEach(button => {
        button.addEventListener('click', closePalette);
    });
    paletteModal?.addEventListener('click', event => {
        if (!(event.target instanceof Element)) return;
        const styleOption = event.target.closest('[data-ui-style]');
        if (styleOption && paletteModal.contains(styleOption)) {
            const uiStyle = styleOption.getAttribute('data-ui-style');
            if (!uiStyle || !UI_STYLES.has(uiStyle)) return;
            localStorage.setItem('curato-ui-style', uiStyle);
            applyTheme(
                document.body.classList.contains('dark-mode') ? 'dark' : 'light',
                document.body.dataset.colorTheme,
                uiStyle
            );
            return;
        }

        const colorOption = event.target.closest('[data-color-theme]');
        if (!colorOption || !paletteModal.contains(colorOption)) return;
        const colorTheme = colorOption.getAttribute('data-color-theme');
        if (!colorTheme) return;
        localStorage.setItem('curato-color-theme', colorTheme);
        applyTheme(document.body.classList.contains('dark-mode') ? 'dark' : 'light', colorTheme);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && paletteModal && !paletteModal.classList.contains('hidden')) {
            closePalette();
        }
    });
}

function getOutfitItems(itemReferences) {
    const references = new Set(itemReferences);
    return consultationItems
        .filter(item => references.has(item.reference))
        .map(({ reference, ...item }) => item);
}

function updateWardrobeSelectionUI() {
    const catalogGrid = document.getElementById('catalog-grid');
    const toggleButton = document.getElementById('toggle-selection-btn');
    const actions = document.getElementById('selection-actions');
    const count = document.getElementById('selection-count');
    const saveButton = document.getElementById('save-selection-btn');
    const selectedCount = selectedWardrobeItems.size;

    catalogGrid?.classList.toggle('selection-mode', wardrobeSelectionMode);
    if (toggleButton) {
        toggleButton.setAttribute('aria-pressed', String(wardrobeSelectionMode));
        toggleButton.innerHTML = wardrobeSelectionMode
            ? '<i class="fa-solid fa-check mr-1"></i>Done selecting'
            : '<i class="fa-regular fa-square-check mr-1"></i>Select items';
    }
    actions?.classList.toggle('hidden', !wardrobeSelectionMode && selectedCount === 0);
    if (count) count.textContent = `${selectedCount} selected`;
    if (saveButton) saveButton.disabled = selectedCount === 0;
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
        return `<article class="favorite-panel">
            <div class="favorite-stack" data-favorite-stack tabindex="0" aria-label="Tap to spread ${escapeHTML(outfit.title)}">
                ${cards}
                <div class="favorite-name">${escapeHTML(outfit.title)}</div>
            </div>
            <div>
                <button type="button" class="favorite-action" data-inspect-items="${escapeHTML(outfit.id)}"><i class="fa-solid fa-list-ul"></i> Items <span>(${items.length})</span></button>
                <ul class="favorite-items hidden" data-favorite-items>
                    ${items.map(item => `<li class="flex items-center gap-2 text-xs">
                        <img src="${escapeHTML(item.image_url)}" alt="" class="w-7 h-9 rounded object-cover border border-white/10">
                        <span>${escapeHTML(item.name)}</span>
                    </li>`).join('')}
                </ul>
            </div>
            <div class="favorite-actions">
                <input type="text" value="${escapeHTML(outfit.title)}" data-favorite-title="${escapeHTML(outfit.id)}" class="favorite-title" aria-label="Favorite outfit name">
                <button type="button" class="favorite-action" data-rename-favorite="${escapeHTML(outfit.id)}" aria-label="Rename outfit"><i class="fa-solid fa-pen"></i><span class="hidden sm:inline">Rename</span></button>
                <button type="button" class="favorite-action danger" data-remove-favorite="${escapeHTML(outfit.id)}" aria-label="Remove outfit"><i class="fa-solid fa-trash-can"></i></button>
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
    list.querySelectorAll('[data-inspect-items]').forEach(button => {
        button.onclick = event => {
            event.stopPropagation();
            openItemInspector(button.dataset.inspectItems);
        };
    });
    list.querySelectorAll('[data-remove-favorite]').forEach(button => {
        button.onclick = event => {
            event.stopPropagation();
            removeFavorite(button.dataset.removeFavorite);
        };
    });
    list.querySelectorAll('[data-rename-favorite]').forEach(button => {
        button.onclick = event => {
            event.stopPropagation();
            const input = button.parentElement.querySelector('[data-favorite-title]');
            if (input) renameFavorite(button.dataset.renameFavorite, input.value);
        };
    });
}

function openItemInspector(id) {
    const favorite = favoriteOutfits.find(outfit => outfit.id === id);
    const modal = document.getElementById('item-inspector-modal');
    const title = document.getElementById('item-inspector-title');
    const itemList = document.getElementById('item-inspector-list');
    if (!favorite || !modal || !title || !itemList) return;

    title.innerText = favorite.title;
    itemList.innerHTML = (favorite.items || []).map(item => `
        <div class="inspector-item">
            <img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.name)}">
            <div class="min-w-0">
                <div class="inspector-item-name">${escapeHTML(item.name)}</div>
                <div class="inspector-meta">${escapeHTML(item.tags?.brand || 'Independent')}</div>
                <div class="inspector-meta">${escapeHTML(item.tags?.subcategory || item.tags?.category || 'Item')}</div>
            </div>
        </div>
    `).join('');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function openConsultationItemInspector(item) {
    const modal = document.getElementById('item-inspector-modal');
    const title = document.getElementById('item-inspector-title');
    const itemList = document.getElementById('item-inspector-list');
    if (!item || !modal || !title || !itemList) return;

    const tags = item.tags || {};
    const details = Object.entries(tags)
        .filter(([key, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => `
            <div class="item-detail-row">
                <span>${escapeHTML(key.replace(/_/g, ' '))}</span>
                <strong>${escapeHTML(String(value))}</strong>
            </div>
        `).join('');

    title.innerText = item.name;
    itemList.innerHTML = `
        <div class="consultation-inspector-item">
            <img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.name)}">
            <div class="consultation-inspector-details">
                <div class="inspector-item-name">${escapeHTML(item.name)}</div>
                ${details}
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
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

const INSPIRE_WISHLIST_KEY = 'curato-inspire-wishlist';
const INSPIRE_BRANDS_KEY = 'curato-inspire-brands';
const INSPIRE_PRESENTATION_KEY = 'curato-inspire-presentation';
const INSPIRE_LIVE_CACHE_KEY = 'curato-inspire-live-cache';
const INSPIRE_LIVE_CACHE_MS = 30 * 60 * 1000;
let inspirePresentation = 'feminine';
let liveInspireProducts = [];

const inspireIdeas = [
    { id: 'poplin-shirt', name: 'Relaxed cotton poplin shirt', category: 'Top', detail: 'A crisp, easy layer for everyday rotation.', keywords: 'white cotton shirt crisp spring layering', image: 'photo-1596755094514-f87e34085b2c' },
    { id: 'wide-leg-jeans', name: 'Wide-leg denim', category: 'Bottom', detail: 'A new silhouette that works with your familiar favourites.', keywords: 'denim jeans blue relaxed wide leg', image: 'photo-1542272604-787c3835535d' },
    { id: 'lightweight-jacket', name: 'Lightweight utility jacket', category: 'Outerwear', detail: 'A practical top layer for changeable days.', keywords: 'jacket utility lightweight olive spring coat layer', image: 'photo-1591047139829-d91aecb6caea' },
    { id: 'everyday-trainers', name: 'Minimal everyday trainers', category: 'Shoes', detail: 'A clean finishing touch for relaxed looks.', keywords: 'trainers sneakers shoes white everyday casual', image: 'photo-1542291026-7eec264c27ff' },
    { id: 'leather-loafers', name: 'Polished leather loafers', category: 'Shoes', detail: 'An understated way to dress up your daily uniform.', keywords: 'loafers leather shoes black smart', image: 'photo-1543163521-1bf539c55dd2' },
    { id: 'shoulder-bag', name: 'Soft shoulder bag', category: 'Bag', detail: 'A useful shape with room for the everyday essentials.', keywords: 'bag shoulder handbag brown leather accessory', image: 'photo-1584917865442-de89df76afd3' },
    { id: 'fine-knit', name: 'Fine-knit crew neck', category: 'Top', detail: 'An easy mid-layer that slips into your existing outfits.', keywords: 'knit sweater jumper crew neck soft layer', image: 'photo-1620799140408-edc6dcb6d633' },
    { id: 'linen-trousers', name: 'Relaxed linen trousers', category: 'Bottom', detail: 'A breathable option for warmer days and laid-back plans.', keywords: 'linen trousers pants relaxed summer beige', image: 'photo-1506629905607-d9aa6b4e66df' },
    { id: 'structured-blazer', name: 'Soft-shoulder blazer', category: 'Outerwear', detail: 'A versatile layer to bring a little structure to a look.', keywords: 'blazer jacket tailored navy smart layer', image: 'photo-1591047139829-d91aecb6caea' },
    { id: 'leather-belt', name: 'Everyday leather belt', category: 'Accessory', detail: 'A small finishing detail that earns its place.', keywords: 'belt leather accessory brown black', image: 'photo-1624222247344-550fb8f9a72b' },
    { id: 'silver-watch', name: 'Clean-lined silver watch', category: 'Accessory', detail: 'A considered everyday accessory, kept simple.', keywords: 'watch silver minimal accessory wrist', image: 'photo-1523275335684-37898b6baf30' },
    { id: 'canvas-tote', name: 'Structured canvas tote', category: 'Bag', detail: 'A roomy everyday carryall with a relaxed feel.', keywords: 'tote bag canvas everyday carryall', image: 'photo-1590874103328-eac38a683ce7' }
];

function loadInspireWishlist() {
    try {
        const storedWishlist = localStorage.getItem(INSPIRE_WISHLIST_KEY);
        if (!storedWishlist) return [];
        const parsedWishlist = JSON.parse(storedWishlist);
        if (!Array.isArray(parsedWishlist)) throw new Error('Saved wishlist must be a list.');
        return parsedWishlist.filter(item =>
            item
            && typeof item.id === 'string'
            && typeof item.name === 'string'
            && typeof item.category === 'string'
            && typeof item.detail === 'string'
            && typeof item.store === 'string'
            && typeof item.image === 'string'
            && (item.brands === undefined || typeof item.brands === 'string')
            && (item.url === undefined || typeof item.url === 'string')
            && (item.retailer === undefined || typeof item.retailer === 'string')
        );
    } catch (error) {
        console.error('Unable to read the Inspire wishlist:', error);
        return [];
    }
}

function persistInspireWishlist(nextWishlist) {
    localStorage.setItem(INSPIRE_WISHLIST_KEY, JSON.stringify(nextWishlist));
}

function getInspireShopUrl(store, productName, brandNames) {
    const preferredBrands = brandNames.split(',').map(brand => brand.trim()).filter(Boolean);
    const query = store === 'Your brands' && preferredBrands.length
        ? `${preferredBrands.join(' ')} ${productName}`
        : productName;
    const encodedQuery = encodeURIComponent(query);

    return `https://www.google.com/search?tbm=shop&q=${encodedQuery}`;
}

function getInspireSearchContext() {
    return {
        category: document.getElementById('inspire-category')?.value || 'All',
        query: document.getElementById('inspire-search')?.value.trim() || '',
        brands: document.getElementById('inspire-brands')?.value.trim() || '',
        presentation: inspirePresentation
    };
}

function getInspireCacheKey(context) {
    return JSON.stringify(context).toLowerCase();
}

function isSafeRetailerUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !/^(www\.)?(google|bing|yahoo)\./i.test(url.hostname);
    } catch {
        return false;
    }
}

function retailerNameFromUrl(value) {
    try {
        return new URL(value).hostname.replace(/^www\./, '').split('.')[0].replace(/[-_]/g, ' ');
    } catch {
        return 'Retailer';
    }
}

function renderLiveInspireProducts() {
    const grid = document.getElementById('inspire-grid');
    const resultCount = document.getElementById('inspire-results-count');
    if (!grid || !liveInspireProducts.length) return false;
    if (resultCount) resultCount.textContent = `${liveInspireProducts.length} live ${liveInspireProducts.length === 1 ? 'product' : 'products'} · checked sources`;
    grid.innerHTML = liveInspireProducts.map(product => {
        const saved = inspireWishlist.some(item => item.id === product.id);
        const pairings = getInspireWardrobePairings(product);
        const pairingMarkup = pairings.length
            ? pairings.map(item => `<span class="flex min-w-0 items-center gap-2"><img src="${escapeHTML(item.image_url)}" alt="" loading="lazy"><span class="truncate"><strong class="text-[var(--ink)]">${escapeHTML(item.name)}</strong><span class="block text-[9px]">from your wardrobe</span></span></span>`).join('')
            : '<span class="min-w-0"><strong class="text-[var(--ink)]">Your wardrobe, next</strong><span class="block">Add pieces to see how they pair.</span></span>';
        return `<article class="inspire-card inspire-live-card">
            <div class="inspire-live-source"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i><span>Live retailer listing</span><span>${escapeHTML(product.retailer)}</span></div>
            <div class="inspire-card-body">
                <p class="eyebrow mb-2">${escapeHTML(product.category)} · ${escapeHTML(product.presentation)}</p>
                <h3 class="accent-font text-lg font-bold leading-snug tracking-[-.04em]">${escapeHTML(product.name)}</h3>
                <p class="mt-2 text-xs leading-5 text-[var(--muted)]">${escapeHTML(product.detail)}</p>
                <div class="inspire-pairing"><i class="fa-solid fa-link text-[var(--purple)]" aria-hidden="true"></i><div class="flex min-w-0 flex-wrap gap-x-4 gap-y-2">${pairingMarkup}</div></div>
                <div class="inspire-actions">
                    <a class="inspire-shop-link" href="${escapeHTML(product.url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>View product</a>
                    <button type="button" class="inspire-save-button" data-save-inspire="${escapeHTML(product.id)}" data-inspire-name="${escapeHTML(product.name)}" data-inspire-category="${escapeHTML(product.category)}" data-inspire-detail="${escapeHTML(product.detail)}" data-inspire-keywords="${escapeHTML(product.keywords)}" data-inspire-image="${escapeHTML(product.image)}" data-inspire-url="${escapeHTML(product.url)}" data-inspire-retailer="${escapeHTML(product.retailer)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Add'} ${escapeHTML(product.name)} ${saved ? 'from' : 'to'} wishlist"><i class="fa-${saved ? 'solid' : 'regular'} fa-heart" aria-hidden="true"></i>${saved ? 'Saved' : 'Save'}</button>
                </div>
            </div>
        </article>`;
    }).join('');
    return true;
}

async function findLiveInspireProducts() {
    const button = document.getElementById('find-live-products');
    const note = document.getElementById('inspire-search-note');
    const context = getInspireSearchContext();
    const cacheKey = getInspireCacheKey(context);
    try {
        const cached = JSON.parse(localStorage.getItem(INSPIRE_LIVE_CACHE_KEY) || '{}');
        if (cached.key === cacheKey && Date.now() - cached.createdAt < INSPIRE_LIVE_CACHE_MS && Array.isArray(cached.products)) {
            liveInspireProducts = cached.products;
            renderLiveInspireProducts();
            if (note) note.textContent = 'Showing your recent live search. Product availability is confirmed by the retailer when you open it.';
            return;
        }
    } catch { /* A failed cache should never block a fresh search. */ }

    const keyInput = document.getElementById('user-api-key');
    const { data: { session } } = await supabase.auth.getSession();
    const activeKey = keyInput?.value.trim() || session?.user?.user_metadata?.gemini_api_key;
    const activeModel = document.getElementById('model-select')?.value || session?.user?.user_metadata?.preferred_model || 'gemini-2.0-flash';
    if (!activeKey) {
        alert('Add your Gemini API key in Account to search live products. You can still browse the style edit without it.');
        return;
    }
    if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>Searching live products'; }
    if (note) note.textContent = 'Searching current retailer pages. This is one short, grounded request…';
    const style = context.presentation === 'all' ? 'a balanced mix of feminine and masculine presentations' : `${context.presentation} presentation`;
    const category = context.category === 'All' ? 'clothing, shoes, bags, or accessories that best match the request' : context.category;
    const prompt = `Use Google Search to find 6–8 CURRENT, INDIVIDUAL, BUYABLE product pages from a range of retailers, not search-result pages or editorial pages. The shopper wants: ${context.query || 'versatile wardrobe upgrades'}. Category: ${category}. Style presentation: ${style}. Preferred brands, if useful: ${context.brands || 'none'}.
Return a short JSON array only. Each entry must have: name, category, detail (one short practical sentence), url. Only include a URL if the exact product page was found in your grounded web sources. Do not make up URLs, prices, stock status, or product names.`;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${activeKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.1, maxOutputTokens: 900 } })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || 'Live product search failed.');
        const text = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '[]';
        const citedUrls = new Set((result.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
            .map(chunk => chunk.web?.uri).filter(isSafeRetailerUrl));
        const requestedProducts = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
        const seenUrls = new Set();
        liveInspireProducts = (Array.isArray(requestedProducts) ? requestedProducts : [])
            .filter(item => item && typeof item.url === 'string' && citedUrls.has(item.url) && !seenUrls.has(item.url) && (seenUrls.add(item.url), true))
            .slice(0, 8).map((item, index) => ({
                id: `live-${Date.now()}-${index}`, name: String(item.name || 'Retailer product'), category: String(item.category || context.category),
                detail: String(item.detail || 'A live retailer listing selected for this search.'), keywords: context.query, image: inspireIdeas[index % inspireIdeas.length].image,
                url: item.url, retailer: retailerNameFromUrl(item.url), presentation: context.presentation
            }));
        if (!liveInspireProducts.length) throw new Error('No cited product pages were returned. Please try a more specific search.');
        localStorage.setItem(INSPIRE_LIVE_CACHE_KEY, JSON.stringify({ key: cacheKey, createdAt: Date.now(), products: liveInspireProducts }));
        renderLiveInspireProducts();
        if (note) note.textContent = 'Live links come from the search’s retailer sources. Availability and checkout stay with each retailer.';
    } catch (error) {
        console.error('Live Inspire search failed:', error);
        if (note) note.textContent = error.message || 'We could not verify live product pages for that search. Try a more specific phrase.';
    } finally {
        if (button) { button.disabled = false; button.innerHTML = '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>Find live products'; }
    }
}

function getInspireWardrobePairings(idea) {
    const compatibleCategories = {
        Top: ['bottom', 'shoe'],
        Bottom: ['top', 'shoe'],
        Outerwear: ['top', 'bottom'],
        Shoes: ['top', 'bottom'],
        Bag: ['top', 'bottom'],
        Accessory: ['top', 'bottom']
    };
    const wanted = compatibleCategories[idea.category] || ['top', 'bottom'];
    return wardrobeItems
        .filter(item => {
            const category = `${item.tags?.subcategory || ''} ${item.tags?.category || ''}`.toLowerCase();
            return wanted.some(match => category.includes(match));
        })
        .slice(0, 2);
}

function renderInspireIdeas() {
    const grid = document.getElementById('inspire-grid');
    const resultCount = document.getElementById('inspire-results-count');
    const categoryFilter = document.getElementById('inspire-category')?.value || 'All';
    const searchTerm = document.getElementById('inspire-search')?.value.trim().toLowerCase() || '';
    const store = 'All retailers';
    const brandNames = document.getElementById('inspire-brands')?.value || '';
    if (!grid) return;

    const searchTerms = searchTerm.split(/\s+/).filter(term => !['a', 'an', 'and', 'for', 'in', 'of', 'the', 'to', 'with'].includes(term));
    const matchingIdeas = inspireIdeas.map(idea => {
        const matchesCategory = categoryFilter === 'All' || idea.category === categoryFilter;
        const searchableText = `${idea.name} ${idea.category} ${idea.detail} ${idea.keywords}`.toLowerCase();
        const score = searchTerms.reduce((total, term) => total + Number(searchableText.includes(term)), 0);
        return { idea, matchesCategory, score };
    }).filter(result => result.matchesCategory && (!searchTerms.length || result.score > 0))
        .sort((first, second) => second.score - first.score)
        .map(result => result.idea);
    let ideas = matchingIdeas;
    if (searchTerm && ideas.length === 0) {
        const category = categoryFilter !== 'All'
            ? categoryFilter
            : /shoe|trainer|loafer|boot/.test(searchTerm) ? 'Shoes'
                : /bag|tote|purse/.test(searchTerm) ? 'Bag'
                    : /coat|jacket|blazer|layer/.test(searchTerm) ? 'Outerwear'
                        : /trouser|jean|skirt|bottom/.test(searchTerm) ? 'Bottom' : 'Top';
        const safeId = searchTerm.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'style-search';
        ideas = [{
            id: `search-${safeId}`,
            name: searchTerm.replace(/\b\w/g, letter => letter.toUpperCase()),
            category,
            detail: 'A style direction based on your search. Explore current retailer results to find your version.',
            keywords: searchTerm,
            image: inspireIdeas.find(idea => idea.category === category)?.image || inspireIdeas[0].image
        }];
    } else if (!searchTerm && ideas.length > 0) {
        const start = inspireOffset % ideas.length;
        ideas = [...ideas.slice(start), ...ideas.slice(0, start)].slice(0, 6);
    }

    if (resultCount) resultCount.textContent = `${ideas.length} ${ideas.length === 1 ? 'idea' : 'ideas'}`;
    if (ideas.length === 0) {
        grid.innerHTML = '<div class="surface col-span-full rounded-[20px] p-8 text-center text-sm text-[var(--muted)]">No ideas match those filters yet. Try another item type or search.</div>';
        return;
    }

    grid.innerHTML = ideas.map(idea => {
        const saved = inspireWishlist.some(item => item.id === idea.id);
        const pairings = getInspireWardrobePairings(idea);
        const pairingMarkup = pairings.length
            ? pairings.map(item => `<span class="flex min-w-0 items-center gap-2"><img src="${escapeHTML(item.image_url)}" alt="" loading="lazy"><span class="truncate"><strong class="text-[var(--ink)]">${escapeHTML(item.name)}</strong><span class="block text-[9px]">from your wardrobe</span></span></span>`).join('')
            : '<span class="min-w-0"><strong class="text-[var(--ink)]">Your wardrobe, next</strong><span class="block">Add pieces to see how they pair.</span></span>';
        const hasBrands = brandNames.split(',').some(brand => brand.trim());
        const shopLabel = hasBrands ? 'Search preferred brands' : 'Search all retailers';
        return `<article class="inspire-card">
            <div class="inspire-image">
                <img src="https://images.unsplash.com/${escapeHTML(idea.image)}?auto=format&fit=crop&w=900&q=82" alt="Style reference for ${escapeHTML(idea.name)}" loading="lazy">
                <span class="inspire-image-label">Style reference · ${escapeHTML(idea.category)}</span>
            </div>
            <div class="inspire-card-body">
                <p class="eyebrow mb-2">${escapeHTML(hasBrands ? brandNames.split(',').map(brand => brand.trim()).filter(Boolean).slice(0, 2).join(' · ') : store)}</p>
                <h3 class="accent-font text-lg font-bold leading-snug tracking-[-.04em]">${escapeHTML(idea.name)}</h3>
                <p class="mt-2 text-xs leading-5 text-[var(--muted)]">${escapeHTML(idea.detail)}</p>
                <div class="inspire-pairing"><i class="fa-solid fa-link text-[var(--purple)]" aria-hidden="true"></i><div class="flex min-w-0 flex-wrap gap-x-4 gap-y-2">${pairingMarkup}</div></div>
                <div class="inspire-actions">
                    <a class="inspire-shop-link" href="${escapeHTML(getInspireShopUrl(store, idea.name, brandNames))}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>${escapeHTML(shopLabel)}</a>
                    <button type="button" class="inspire-save-button" data-save-inspire="${escapeHTML(idea.id)}" data-inspire-name="${escapeHTML(idea.name)}" data-inspire-category="${escapeHTML(idea.category)}" data-inspire-detail="${escapeHTML(idea.detail)}" data-inspire-keywords="${escapeHTML(idea.keywords)}" data-inspire-image="${escapeHTML(idea.image)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Add'} ${escapeHTML(idea.name)} ${saved ? 'from' : 'to'} wishlist"><i class="fa-${saved ? 'solid' : 'regular'} fa-heart" aria-hidden="true"></i>${saved ? 'Saved' : 'Save'}</button>
                </div>
            </div>
        </article>`;
    }).join('');
}

function renderInspireWishlist() {
    const grid = document.getElementById('inspire-wishlist-list');
    const emptyMessage = document.getElementById('inspire-wishlist-empty');
    const count = document.getElementById('inspire-wishlist-count');
    if (count) count.textContent = String(inspireWishlist.length);
    if (emptyMessage) emptyMessage.classList.toggle('hidden', inspireWishlist.length > 0);
    if (!grid) return;

    grid.innerHTML = inspireWishlist.map(item => `<article class="inspire-wishlist-card">
        <img class="inspire-wishlist-image" src="https://images.unsplash.com/${escapeHTML(item.image)}?auto=format&fit=crop&w=300&q=75" alt="Style reference for ${escapeHTML(item.name)}" loading="lazy">
        <div class="inspire-wishlist-content">
            <p class="eyebrow mb-1">${escapeHTML(item.category)} · ${escapeHTML(item.store)}</p>
            <h3 class="accent-font text-sm font-bold leading-snug">${escapeHTML(item.name)}</h3>
            <div class="mt-3 flex flex-wrap gap-2">
                <a class="inspire-shop-link min-h-[34px] px-3" href="${escapeHTML(isSafeRetailerUrl(item.url) ? item.url : getInspireShopUrl(item.store, item.name, item.brands || ''))}" target="_blank" rel="noopener noreferrer">${isSafeRetailerUrl(item.url) ? 'View product' : 'Shop search'}<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
                <button class="inspire-remove-button min-h-[34px] px-3" type="button" data-remove-inspire="${escapeHTML(item.id)}" aria-label="Remove ${escapeHTML(item.name)} from wishlist">Remove</button>
            </div>
        </div>
    </article>`).join('');
}

// ========================================
// AI RESPONSE RENDERER
// ========================================

function renderAIResponse(text, itemReferences = []) {

    const selectedItems = Array.isArray(itemReferences)
        ? itemReferences
            .map(reference => consultationItems.find(item => item.reference === reference))
            .filter(Boolean)
        : [];

    let html = '';

    if (selectedItems.length) {
        html += `
            <div class="ai-item-strip">
                ${selectedItems.map(item => `
                    <button type="button" class="ai-item-card" data-consultation-reference="${item.reference}" aria-label="Inspect ${escapeHTML(item.name)}">
                        <img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.name)}" loading="lazy">
                        <span>${escapeHTML(item.name)}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    // Clean markdown artifacts
    text = text
        .replace(/```markdown/g, '')
        .replace(/```/g, '')
        .trim();

    text = text.replace(/### Styling Notes\s*[\r\n]+([\s\S]*?)(?=\n### |\n## |$)/i, (_, body) => {
        const compact = body
            .replace(/\s+/g, ' ')
            .trim();
        return `### Styling Notes\n${compact || 'Confident, polished, and easy.'}`;
    });

    // Split into sections
    const lines = text.split('\n');

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
                    ${escapeHTML(line.replace('## ', ''))}
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
                    ${escapeHTML(line.replace('### ', ''))}
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

            const clean = escapeHTML(line.replace(/^[-*]\s/, ''))
            .replace(
                /\*\*(.*?)\*\*/g,
                '<strong class="text-white font-medium">$1</strong>'
            );

            html += `
                <li class="flex gap-4 items-start">
                    <div class="w-1.5 h-1.5 rounded-full bg-[#d4ff6a] mt-2 shrink-0"></div>
                    <div class="response-copy">
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
                    ${escapeHTML(line.replace('> ', ''))}
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
            <p class="response-copy">
                ${escapeHTML(line).replace(
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

function decodeConsultationTags(taggedResponse) {
    const source = taggedResponse
        .replace(/```(?:text|xml)?\s*/gi, '')
        .replace(/```/g, '')
        .trim();
    const tagPattern = /<(header|text|item)>([\s\S]*?)<\/\1>/g;
    const sections = [];
    const itemReferences = [];
    let cursor = 0;

    for (const match of source.matchAll(tagPattern)) {
        if (source.slice(cursor, match.index).trim()) {
            throw new Error("Consultant returned content outside the allowed tags.");
        }

        const [, tag, value] = match;
        const content = value.trim();
        if (!content) {
            throw new Error("Consultant returned an empty tagged section.");
        }

        if (tag === 'header') {
            sections.push(`## ${content}`);
        } else if (tag === 'text') {
            sections.push(content);
        } else {
            if (!/^\d+$/.test(content)) {
                throw new Error("Consultant returned an invalid archive item reference.");
            }
            const reference = Number(content);
            if (!Number.isSafeInteger(reference) || itemReferences.includes(reference)) {
                throw new Error("Consultant returned an invalid or duplicate archive item reference.");
            }
            itemReferences.push(reference);
        }

        cursor = match.index + match[0].length;
    }

    if (!sections.length || source.slice(cursor).trim()) {
        throw new Error("Consultant returned an incomplete tagged response.");
    }

    return {
        response: sections.join('\n\n'),
        item_references: itemReferences
    };
}

// ========================================
// GEMINI
// ========================================

async function callGeminiAPI(base64, mimeType, promptText, responseFormat = 'json') {

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

    if (responseFormat === 'json') {

        try {

            const cleaned =
                resultText
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .trim();

            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            const jsonText = start >= 0 && end > start
                ? cleaned.slice(start, end + 1)
                : cleaned;

            return JSON.parse(jsonText);

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
    const normalizedQuery = searchQuery.trim().toLowerCase();
    let filtered = items;

    if (normalizedQuery) {
        filtered = filtered.filter(item => {
            const haystack = [
                item.name,
                item.tags?.brand,
                item.tags?.category,
                item.tags?.subcategory,
                item.tags?.color,
                item.tags?.material,
                ...(Object.values(item.tags || {}))
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(normalizedQuery);
        });
    }

    if (currentSortClass === "ALL") {
        return filtered;
    }

    return filtered.filter(i => {

        if (currentSortClass === "TOPS") {
            return i.tags?.subcategory === "Top" || i.tags?.category === "Top";
        }

        if (currentSortClass === "BOTTOMS") {
            return i.tags?.subcategory === "Bottom" || i.tags?.category === "Bottom";
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

    wardrobeItems = data || [];
    const availableIds = new Set(wardrobeItems.map(item => String(item.id)));
    selectedWardrobeItems = new Set(
        [...selectedWardrobeItems].filter(id => availableIds.has(id))
    );
    const filtered = sortItems(wardrobeItems);

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

    catalogGrid.classList.toggle('selection-mode', wardrobeSelectionMode);
    catalogGrid.innerHTML = filtered.map(item => {
        const tags = item.tags || {};
        const category = tags.subcategory || tags.category || 'Item';
        const itemId = String(item.id);
        const isSelected = selectedWardrobeItems.has(itemId);
        const detailEntries = Object.entries(tags)
            .filter(([key, value]) => value !== null && value !== undefined && value !== '' && key !== 'brand' && key !== 'category' && key !== 'subcategory')
            .map(([key, value]) => `
                <div class="item-detail-row">
                    <span>${escapeHTML(key.replace(/_/g, ' '))}</span>
                    <strong>${escapeHTML(String(value))}</strong>
                </div>
            `).join('');

        return `
            <article class="item-card group${isSelected ? ' is-selected' : ''}" data-item-card data-item-id="${escapeHTML(itemId)}" tabindex="0" aria-expanded="false">
                <div class="img-container">
                    <img src="${escapeHTML(item.image_url)}" loading="lazy" alt="${escapeHTML(item.name)}">
                    <button type="button" class="item-select-button" data-select-wardrobe-item="${escapeHTML(itemId)}" aria-pressed="${isSelected}" aria-label="${isSelected ? 'Remove' : 'Select'} ${escapeHTML(item.name)}">
                        <i class="${isSelected ? 'fa-solid fa-check' : 'fa-regular fa-square'}" aria-hidden="true"></i>
                        <span>${isSelected ? 'Selected' : 'Select'}</span>
                    </button>
                </div>
                <div class="mt-5">
                    <p class="text-[11px] font-medium uppercase tracking-widest text-white/90">${escapeHTML(item.name)}</p>
                    <p class="text-[9px] text-white/30 uppercase tracking-[0.15em] mt-1">
                        ${escapeHTML(tags.brand || 'Independent')} • ${escapeHTML(category)}
                    </p>
                </div>
                <div class="item-details" aria-hidden="true">
                    <div class="item-detail-row">
                        <span>Category</span>
                        <strong>${escapeHTML(tags.category || 'Other')}</strong>
                    </div>
                    ${tags.subcategory ? `
                        <div class="item-detail-row">
                            <span>Type</span>
                            <strong>${escapeHTML(tags.subcategory)}</strong>
                        </div>
                    ` : ''}
                    ${detailEntries}
                    <div class="item-card-actions">
                        <button type="button" class="item-card-action" data-edit-item="${escapeHTML(String(item.id))}"><i class="fa-solid fa-pen"></i> Edit</button>
                        <button type="button" class="item-card-action danger" data-delete-item="${escapeHTML(String(item.id))}"><i class="fa-solid fa-trash-can"></i> Delete</button>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    catalogGrid.querySelectorAll('[data-item-card]').forEach(card => {
        const itemId = card.dataset.itemId;
        const selectButton = card.querySelector('[data-select-wardrobe-item]');
        const toggleSelection = () => {
            if (selectedWardrobeItems.has(itemId)) {
                selectedWardrobeItems.delete(itemId);
            } else {
                selectedWardrobeItems.add(itemId);
            }
            const isSelected = selectedWardrobeItems.has(itemId);
            card.classList.toggle('is-selected', isSelected);
            selectButton?.setAttribute('aria-pressed', String(isSelected));
            selectButton?.setAttribute('aria-label', `${isSelected ? 'Remove' : 'Select'} ${card.querySelector('img')?.alt || 'item'}`);
            if (selectButton) {
                selectButton.innerHTML = `<i class="${isSelected ? 'fa-solid fa-check' : 'fa-regular fa-square'}" aria-hidden="true"></i><span>${isSelected ? 'Selected' : 'Select'}</span>`;
            }
            updateWardrobeSelectionUI();
        };
        const toggle = () => {
            if (wardrobeSelectionMode) {
                toggleSelection();
                return;
            }
            const expanded = card.getAttribute('aria-expanded') === 'true';
            card.setAttribute('aria-expanded', String(!expanded));
            card.querySelector('.item-details')?.setAttribute('aria-hidden', String(expanded));
        };

        card.addEventListener('click', toggle);
        card.addEventListener('keydown', event => {
            if (event.target !== card) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
            }
        });
        selectButton?.addEventListener('click', event => {
            event.stopPropagation();
            toggleSelection();
        });
    });

    catalogGrid.querySelectorAll('[data-edit-item]').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            openItemEditor(data.find(item => String(item.id) === button.dataset.editItem));
        });
    });

    catalogGrid.querySelectorAll('[data-delete-item]').forEach(button => {
        button.addEventListener('click', async event => {
            event.stopPropagation();
            await deleteItem(button.dataset.deleteItem);
        });
    });
    updateWardrobeSelectionUI();
    renderInspireIdeas();
}

function openItemEditor(item) {
    if (!item) return;
    editingItemId = item.id;
    editingImageData = null;
    document.getElementById('edit-item-name').value = item.name || '';
    document.getElementById('edit-item-brand').value = item.tags?.brand || '';
    const preview = document.getElementById('edit-item-preview');
    preview.src = item.image_url;
    preview.classList.remove('hidden');
    const modal = document.getElementById('item-editor-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function deleteItem(id) {
    if (!window.confirm('Delete this piece from your library?')) return;
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) {
        console.error(error);
        alert(`Delete failed: ${error.message}`);
        return;
    }
    await fetchItems();
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
    initializeTheme();
    inspireWishlist = loadInspireWishlist();
    try {
        inspirePresentation = localStorage.getItem(INSPIRE_PRESENTATION_KEY) || 'feminine';
    } catch { /* Default presentation is intentionally safe. */ }
    renderInspireWishlist();
    renderInspireIdeas();

    const inspireBrandsInput = document.getElementById('inspire-brands');
    if (inspireBrandsInput) {
        try {
            inspireBrandsInput.value = localStorage.getItem(INSPIRE_BRANDS_KEY) || '';
        } catch (error) {
            console.error('Unable to read your favourite brands:', error);
            alert('Your favourite brands could not be loaded from this browser.');
        }
        inspireBrandsInput.addEventListener('change', () => {
            try {
                localStorage.setItem(INSPIRE_BRANDS_KEY, inspireBrandsInput.value.trim());
                liveInspireProducts = [];
                renderInspireIdeas();
                renderInspireWishlist();
            } catch (error) {
                console.error('Unable to save your favourite brands:', error);
                alert('Your favourite brands could not be saved in this browser.');
            }
        });
    }

    document.querySelectorAll('[data-inspire-presentation]').forEach(button => {
        const active = button.dataset.inspirePresentation === inspirePresentation;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
        button.addEventListener('click', () => {
            inspirePresentation = button.dataset.inspirePresentation;
            try { localStorage.setItem(INSPIRE_PRESENTATION_KEY, inspirePresentation); } catch { /* Preference persistence is optional. */ }
            document.querySelectorAll('[data-inspire-presentation]').forEach(control => {
                const selected = control === button;
                control.classList.toggle('is-active', selected);
                control.setAttribute('aria-pressed', String(selected));
            });
            liveInspireProducts = [];
            renderInspireIdeas();
        });
    });

    const appTabs = Array.from(document.querySelectorAll('[data-show-view]'));
    appTabs.forEach((button, index) => {
        button.tabIndex = button.getAttribute('aria-selected') === 'true' ? 0 : -1;
        button.addEventListener('click', () => {
            const target = button.dataset.showView;
            document.querySelectorAll('[data-app-view]').forEach(view => {
                view.classList.toggle('hidden', view.dataset.appView !== target);
            });
            appTabs.forEach(tab => {
                const selected = tab === button;
                tab.setAttribute('aria-selected', String(selected));
                tab.tabIndex = selected ? 0 : -1;
            });
            if (target === 'inspire') (liveInspireProducts.length ? renderLiveInspireProducts() : renderInspireIdeas());
        });
        button.addEventListener('keydown', event => {
            let nextIndex = index;
            if (event.key === 'ArrowRight') nextIndex = (index + 1) % appTabs.length;
            else if (event.key === 'ArrowLeft') nextIndex = (index + appTabs.length - 1) % appTabs.length;
            else if (event.key === 'Home') nextIndex = 0;
            else if (event.key === 'End') nextIndex = appTabs.length - 1;
            else return;
            event.preventDefault();
            appTabs[nextIndex].focus();
            appTabs[nextIndex].click();
        });
    });

    const resetLiveInspireResults = () => { liveInspireProducts = []; renderInspireIdeas(); };
    document.getElementById('inspire-category')?.addEventListener('change', resetLiveInspireResults);
    document.getElementById('inspire-search')?.addEventListener('input', resetLiveInspireResults);
    document.getElementById('inspire-search')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            resetLiveInspireResults();
        }
    });
    document.getElementById('refresh-inspire')?.addEventListener('click', () => {
        inspireOffset += 3;
        resetLiveInspireResults();
    });
    document.getElementById('find-live-products')?.addEventListener('click', findLiveInspireProducts);

    const inspireWishlistModal = document.getElementById('inspire-wishlist-modal');
    document.getElementById('open-inspire-wishlist')?.addEventListener('click', () => {
        renderInspireWishlist();
        inspireWishlistModal?.classList.remove('hidden');
        inspireWishlistModal?.classList.add('flex');
    });
    document.querySelectorAll('[data-close-inspire-wishlist]').forEach(button => {
        button.addEventListener('click', () => {
            inspireWishlistModal?.classList.add('hidden');
            inspireWishlistModal?.classList.remove('flex');
        });
    });

    document.addEventListener('click', event => {
        const saveButton = event.target.closest('[data-save-inspire]');
        if (saveButton) {
            const idea = inspireIdeas.find(item => item.id === saveButton.dataset.saveInspire) || {
                id: saveButton.dataset.saveInspire,
                name: saveButton.dataset.inspireName,
                category: saveButton.dataset.inspireCategory,
                detail: saveButton.dataset.inspireDetail,
                keywords: saveButton.dataset.inspireKeywords,
                image: saveButton.dataset.inspireImage,
                url: saveButton.dataset.inspireUrl,
                retailer: saveButton.dataset.inspireRetailer
            };
            if (!idea) return;
            const alreadySaved = inspireWishlist.some(item => item.id === idea.id);
            const nextWishlist = alreadySaved
                ? inspireWishlist.filter(item => item.id !== idea.id)
                : [...inspireWishlist, {
                    ...idea,
                    store: saveButton.dataset.inspireRetailer || 'All retailers',
                    brands: document.getElementById('inspire-brands')?.value || ''
                }];
            try {
                persistInspireWishlist(nextWishlist);
                inspireWishlist = nextWishlist;
                liveInspireProducts.length ? renderLiveInspireProducts() : renderInspireIdeas();
                renderInspireWishlist();
            } catch (error) {
                console.error('Unable to update the Inspire wishlist:', error);
                alert('Your wishlist could not be saved in this browser. Check your browser storage settings and try again.');
            }
            return;
        }

        const removeButton = event.target.closest('[data-remove-inspire]');
        if (removeButton) {
            const nextWishlist = inspireWishlist.filter(item => item.id !== removeButton.dataset.removeInspire);
            try {
                persistInspireWishlist(nextWishlist);
                inspireWishlist = nextWishlist;
                liveInspireProducts.length ? renderLiveInspireProducts() : renderInspireIdeas();
                renderInspireWishlist();
            } catch (error) {
                console.error('Unable to update the Inspire wishlist:', error);
                alert('Your wishlist could not be updated in this browser. Check your browser storage settings and try again.');
            }
        }
    });

    const authBtn =
        document.getElementById('auth-btn');
    const authModal = document.getElementById('auth-modal');
    const githubAuthBtn = document.getElementById('github-auth-btn');
    const discordAuthBtn = document.getElementById('discord-auth-btn');
    const emailAuthForm = document.getElementById('email-auth-form');
    const authEmail = document.getElementById('auth-email');
    const authStatus = document.getElementById('auth-status');
    const accountModal = document.getElementById('account-modal');
    const accountEmail = document.getElementById('account-email');
    const accountName = document.getElementById('account-name');
    const accountApiKey = document.getElementById('account-api-key');
    const accountModel = document.getElementById('account-model');
    const accountForm = document.getElementById('account-settings-form');
    const accountSaveButton = document.getElementById('account-save-btn');
    const accountProviders = document.getElementById('account-providers');
    const accountStatus = document.getElementById('account-status');
    const accountExportButton = document.getElementById('account-export-btn');
    const accountSignOutButton = document.getElementById('account-sign-out-btn');

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

    const promptTypeSelect =
        document.getElementById('prompt-type');

    const promptInput =
        document.getElementById('occasion-input');

    const promptExamples =
        Array.from(document.querySelectorAll('[data-prompt-example]'));

    const suggestionBox =
        document.getElementById('ai-suggestion');

    const saveOutfitBtn =
        document.getElementById('save-outfit-btn');

    const updatePromptMode = () => {
        const mode = promptModes[promptTypeSelect.value] || promptModes.outfit;
        promptInput.placeholder = mode.placeholder;
        promptInput.setAttribute('aria-label', mode.ariaLabel);
        promptExamples.forEach((button, index) => {
            const example = mode.examples[index];
            button.querySelector('i').className = `fa-solid ${example[0]}`;
            button.querySelector('span').textContent = example[1];
            button.dataset.prompt = example[2];
        });
        saveOutfitBtn?.classList.add('hidden');
    };

    promptTypeSelect?.addEventListener('change', updatePromptMode);
    promptExamples.forEach(button => {
        button.addEventListener('click', () => {
            promptInput.value = button.dataset.prompt;
            promptInput.focus();
        });
    });
    updatePromptMode();

    const favoritesBtn =
        document.getElementById('favorites-btn');

    const favoritesModal =
        document.getElementById('favorites-modal');

    const itemInspectorModal =
        document.getElementById('item-inspector-modal');
    const itemEditorModal = document.getElementById('item-editor-modal');
    const itemEditorForm = document.getElementById('item-editor-form');
    const editItemFile = document.getElementById('edit-item-file');
    const editItemPreview = document.getElementById('edit-item-preview');
    const editItemSubmit = document.getElementById('edit-item-submit');

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
    document.querySelectorAll('[data-close-item-inspector]').forEach(button => {
        button.addEventListener('click', () => {
            itemInspectorModal?.classList.add('hidden');
            itemInspectorModal?.classList.remove('flex');
        });
        document.querySelectorAll('[data-close-item-editor]').forEach(button => {
            button.addEventListener('click', () => {
                itemEditorModal?.classList.add('hidden');
                itemEditorModal?.classList.remove('flex');
                editingItemId = null;
                editingImageData = null;
            });
        });

        editItemFile?.addEventListener('change', async event => {
            const file = event.target.files[0];
            if (!file) return;
            editingImageData = await compressImage(file, 900, 0.75);
            editItemPreview.src = editingImageData;
            editItemPreview.classList.remove('hidden');
        });

        itemEditorForm?.addEventListener('submit', async event => {
            event.preventDefault();
            if (!editingItemId) return;
            editItemSubmit.disabled = true;
            editItemSubmit.innerText = 'SAVING...';
            try {
                let imageUrl;
                if (editingImageData) {
                    imageUrl = await uploadImageToStorage(editingImageData);
                }
                const currentItem = await supabase.from('items').select('tags').eq('id', editingItemId).single();
                if (currentItem.error) throw currentItem.error;
                const tags = { ...(currentItem.data.tags || {}), brand: document.getElementById('edit-item-brand').value.trim() };
                const updates = {
                    name: document.getElementById('edit-item-name').value.trim(),
                    tags
                };
                if (imageUrl) updates.image_url = imageUrl;
                const { error } = await supabase.from('items').update(updates).eq('id', editingItemId);
                if (error) throw error;
                itemEditorModal.classList.add('hidden');
                itemEditorModal.classList.remove('flex');
                editingItemId = null;
                editingImageData = null;
                await fetchItems();
            } catch (err) {
                console.error(err);
                alert(`Update failed: ${err.message}`);
            } finally {
                editItemSubmit.disabled = false;
                editItemSubmit.innerText = 'SAVE CHANGES';
            }
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
            const outfitItems = getOutfitItems(latestSuggestion?.item_references || []);
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

    const setAuthStatus = message => {
        if (!authStatus) return;
        authStatus.textContent = message;
        authStatus.classList.toggle('hidden', !message);
    };

    const closeAuthModal = () => {
        authModal?.classList.add('hidden');
        authModal?.classList.remove('flex');
        setAuthStatus('');
    };

    const setAccountStatus = message => {
        if (!accountStatus) return;
        accountStatus.textContent = message;
        accountStatus.classList.toggle('hidden', !message);
    };

    const closeAccountModal = () => {
        accountModal?.classList.add('hidden');
        accountModal?.classList.remove('flex');
        setAccountStatus('');
    };

    const renderAccountProviders = user => {
        if (!accountProviders) return;
        const providerNames = {
            github: 'GitHub',
            discord: 'Discord'
        };
        const connectedProviders = new Set(
            (user.identities || [])
                .filter(identity => Object.hasOwn(providerNames, identity.provider))
                .map(identity => identity.provider)
        );
        const connected = (user.identities || [])
            .filter(identity => Object.hasOwn(providerNames, identity.provider))
            .map(identity => {
            const name = providerNames[identity.provider] || identity.provider;
            const identityEmail = identity.identity_data?.email;
            return `<div class="account-provider">
                <span class="text-sm font-semibold">${escapeHTML(name)}</span>
                <span class="text-xs text-[var(--muted)]">${escapeHTML(identityEmail || 'Connected')}</span>
            </div>`;
            });
        if (user.email && !connectedProviders.has('email')) {
            connected.unshift(`<div class="account-provider">
                <span class="text-sm font-semibold">Email sign-in</span>
                <span class="text-xs text-[var(--muted)]">${escapeHTML(user.email)}</span>
            </div>`);
        }
        const available = Object.entries(providerNames)
            .filter(([provider]) => !connectedProviders.has(provider))
            .map(([provider, name]) => `<button type="button" class="account-provider text-left transition hover:border-[var(--purple)]" data-link-provider="${provider}">
                <span class="text-sm font-semibold"><i class="fa-solid fa-plus mr-2 text-[var(--purple)]"></i>${name}</span>
                <span class="text-xs text-[var(--muted)]">Add</span>
            </button>`);

        accountProviders.innerHTML = [...connected, ...available].join('') ||
            '<p class="text-sm text-[var(--muted)]">No sign-in methods are available.</p>';

        accountProviders.querySelectorAll('[data-link-provider]').forEach(button => {
            button.addEventListener('click', async () => {
                const provider = button.dataset.linkProvider;
                if (!provider) return;
                button.disabled = true;
                setAccountStatus(`Connecting ${providerNames[provider]}...`);
                const { error } = await supabase.auth.linkIdentity({
                    provider,
                    options: { redirectTo: REDIRECT_URL }
                });
                if (error) {
                    setAccountStatus(`Could not connect ${providerNames[provider]}: ${error.message}`);
                    button.disabled = false;
                }
            });
        });
    };

    const openAccountModal = session => {
        if (!session || !accountModal) return;
        const metadata = session.user.user_metadata || {};
        if (accountEmail) accountEmail.textContent = session.user.email || '';
        if (accountName) accountName.value = metadata.full_name || '';
        if (accountApiKey) accountApiKey.value = metadata.gemini_api_key || '';
        if (accountModel) {
            accountModel.value = metadata.preferred_model || modelSelect?.value || accountModel.options[0].value;
        }
        renderAccountProviders(session.user);
        accountModal.classList.remove('hidden');
        accountModal.classList.add('flex');
        setAccountStatus('');
    };

    const openAuthModal = () => {
        authModal?.classList.remove('hidden');
        authModal?.classList.add('flex');
        authEmail?.focus();
    };

    document.querySelectorAll('[data-close-account]').forEach(button => {
        button.addEventListener('click', closeAccountModal);
    });

    accountForm?.addEventListener('submit', async event => {
        event.preventDefault();
        accountSaveButton.disabled = true;
        setAccountStatus('Saving account settings...');
        const { data, error } = await supabase.auth.updateUser({
            data: {
                full_name: accountName?.value.trim() || '',
                gemini_api_key: accountApiKey?.value.trim() || '',
                preferred_model: accountModel?.value || ''
            }
        });
        accountSaveButton.disabled = false;
        if (error) {
            setAccountStatus(`Could not save settings: ${error.message}`);
            return;
        }
        if (keyInput) keyInput.value = accountApiKey?.value.trim() || '';
        if (modelSelect && accountModel) modelSelect.value = accountModel.value;
        if (data.user) renderAccountProviders(data.user);
        setAccountStatus('Account settings saved.');
    });

    accountExportButton?.addEventListener('click', async () => {
        accountExportButton.disabled = true;
        setAccountStatus('Preparing your data export...');
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session) throw new Error('Sign in again to export your data.');

            const [itemsResult, favoritesResult] = await Promise.all([
                supabase.from('items').select('*').eq('user_id', session.user.id),
                supabase.from('favorite_outfits').select('*').eq('user_id', session.user.id)
            ]);
            if (itemsResult.error) throw itemsResult.error;
            if (favoritesResult.error) throw favoritesResult.error;

            const exportData = {
                exported_at: new Date().toISOString(),
                account: {
                    email: session.user.email,
                    display_name: session.user.user_metadata?.full_name || null,
                    preferred_model: session.user.user_metadata?.preferred_model || null
                },
                items: itemsResult.data || [],
                favorite_outfits: favoritesResult.data || []
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `curato-data-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
            setAccountStatus('Your data export has been downloaded.');
        } catch (error) {
            console.error(error);
            setAccountStatus(`Export failed: ${error.message}`);
        } finally {
            accountExportButton.disabled = false;
        }
    });

    accountSignOutButton?.addEventListener('click', async () => {
        accountSignOutButton.disabled = true;
        const { error } = await supabase.auth.signOut();
        accountSignOutButton.disabled = false;
        if (error) {
            setAccountStatus(`Sign out failed: ${error.message}`);
            return;
        }
        closeAccountModal();
        window.location.reload();
    });

    document.querySelectorAll('[data-close-auth]').forEach(button => {
        button.addEventListener('click', closeAuthModal);
    });

    const signInWithProvider = async provider => {
        setAuthStatus('Opening sign in...');
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: REDIRECT_URL }
        });
        if (error) {
            setAuthStatus(error.message);
        }
    };

    githubAuthBtn?.addEventListener('click', () => signInWithProvider('github'));
    discordAuthBtn?.addEventListener('click', () => signInWithProvider('discord'));

    emailAuthForm?.addEventListener('submit', async event => {
        event.preventDefault();
        const email = authEmail?.value.trim();
        if (!email) return;

        const submitButton = emailAuthForm.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        setAuthStatus('Sending your sign-in link...');

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: REDIRECT_URL }
        });

        if (submitButton) submitButton.disabled = false;
        setAuthStatus(error ? error.message : 'Check your inbox for your sign-in link.');
    });

    if (authBtn) {

        authBtn.onclick = async () => {

            const { data: { session } } =
                await supabase.auth.getSession();

            if (session) {
                openAccountModal(session);
            } else {
                openAuthModal();
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
            closeAuthModal();

            if (authBtn) {
                const displayName = session.user.user_metadata?.full_name || session.user.email || 'Account';
                const label = authBtn.querySelector('span');
                if (label) label.textContent = displayName.length > 20 ? `${displayName.slice(0, 17)}...` : displayName;
                authBtn.setAttribute('aria-label', `Open account for ${displayName}`);
                authBtn.title = 'Manage account';
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
                const label = authBtn.querySelector('span');
                if (label) label.textContent = 'Connect';
                authBtn.setAttribute('aria-label', 'Connect your account');
                authBtn.title = 'Connect your account';
            }
            closeAccountModal();

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

    const searchInput = document.getElementById('item-search-input');
    const searchButton = document.getElementById('search-items-btn');

    const applySearch = () => {
        searchQuery = searchInput?.value.trim() || '';
        fetchItems();
    };

    searchInput?.addEventListener('input', applySearch);
    searchInput?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            applySearch();
        }
    });
    searchButton?.addEventListener('click', applySearch);

    const selectionToggleButton = document.getElementById('toggle-selection-btn');
    const clearSelectionButton = document.getElementById('clear-selection-btn');
    const saveSelectionButton = document.getElementById('save-selection-btn');

    selectionToggleButton?.addEventListener('click', () => {
        wardrobeSelectionMode = !wardrobeSelectionMode;
        updateWardrobeSelectionUI();
    });

    clearSelectionButton?.addEventListener('click', () => {
        selectedWardrobeItems.clear();
        wardrobeSelectionMode = false;
        fetchItems();
    });

    saveSelectionButton?.addEventListener('click', async () => {
        if (selectedWardrobeItems.size === 0) return;

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session) {
                alert("Connect your account to save favorite outfits.");
                return;
            }

            const title = window.prompt('Name this outfit', 'My outfit')?.trim();
            if (!title) {
                if (title === '') alert("Outfit name cannot be empty.");
                return;
            }

            const outfitItems = wardrobeItems
                .filter(item => selectedWardrobeItems.has(String(item.id)))
                .map(({ id, name, image_url, tags }) => ({ id, name, image_url, tags }));
            if (!outfitItems.length) {
                alert("Select at least one wardrobe item to save.");
                return;
            }

            saveSelectionButton.disabled = true;
            saveSelectionButton.innerText = 'SAVING...';
            const { error } = await supabase.from('favorite_outfits').insert([{
                user_id: session.user.id,
                title: title.length > 60 ? `${title.slice(0, 60)}...` : title,
                items: outfitItems
            }]);
            if (error) throw error;

            selectedWardrobeItems.clear();
            wardrobeSelectionMode = false;
            updateWardrobeSelectionUI();
            alert("Outfit saved to favorites.");
        } catch (err) {
            console.error(err);
            alert("Outfit save failed: " + err.message);
        } finally {
            saveSelectionButton.disabled = selectedWardrobeItems.size === 0;
            saveSelectionButton.innerHTML = '<i class="fa-regular fa-bookmark mr-2"></i>Save as outfit';
        }
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
            promptTypeSelect.disabled = true;
            latestSuggestion = null;
            saveOutfitBtn?.classList.add('hidden');

            try {

                const promptType = promptTypeSelect.value;
                const promptMode = promptModes[promptType] || promptModes.outfit;

                const { data: items, error: dbError } =
                    await supabase
                        .from('items')
                        .select('id,name,image_url,tags');

                if (dbError) {
                    throw dbError;
                }

                nextItemReference = 1;
                consultationItems = (items || []).map(item => ({
                    ...item,
                    reference: nextItemReference++
                }));

                const wardrobeContext =
                    consultationItems.length > 0

                    ? consultationItems.map(i => {
                        const stylingTags = Object.fromEntries(
                            Object.entries(i.tags || {}).filter(([key]) => key !== 'layerable')
                        );
                        return `- [${i.reference}] ${i.name} (${i.tags?.brand || 'Independent'}, ${i.tags?.category || 'Item'}; item details: ${JSON.stringify(stylingTags)})`;
                    }).join('\n')

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

Use the user's archive as the source of truth for owned items.

Use archive items accurately; never invent an item or details that are not present in the archive. When naming an archived item, use its exact name and include its wardrobe reference using an item tag. If an item has multiple parts, they do not necessarily need to be worn together. If an item has a detachable part (such as a pendant, strap, lining, hood, or charm), explain both attached and detached styling when relevant.

SELECTED CONSULTATION TYPE: ${promptType.toUpperCase()}
${promptMode.instruction}

WARDROBE:

${wardrobeContext}

USER REQUEST:

"${userPrompt}"

OUTPUT CONTRACT — FOLLOW EXACTLY:
1. Return only the tags described here, with no preamble, wrapper, or markdown code fence.
2. Use <header>...</header> for a section heading, <text>...</text> for user-facing prose or markdown, and <item>...</item> for a wardrobe reference number.
3. Tags must be properly closed and have no attributes or nested tags. Text contents may use simple markdown and line breaks.
4. Use one or more header/text sections in a natural reading order. Keep headings concise and match the selected consultation type.
5. After the user-facing sections, add one <item>NUMBER</item> tag for each archived item named or recommended. NUMBER must exactly match that item's bracketed reference in WARDROBE. Never add a tag for an item not mentioned.
6. Do not include reference numbers in header or text contents. If no archived items are relevant, omit item tags.
7. Make the selected consultation type visibly shape the answer: outfit = one complete look; item = advice anchored on the requested piece; wardrobe = direct archive-based answer; packing = a grouped packing list; general = a direct style answer. Do not substitute one format for another just because the request mentions clothes.
8. Keep advice elegant and practical, and do not use emojis.

Example format only:
<header>The Look</header>
<text>Wear the archived navy jacket with the clean white shirt for a balanced, versatile combination.</text>
<item>2</item>

FINAL CHECK BEFORE ANSWERING:
- Every tag is properly closed and contains only its intended value.
- Each archive item mentioned in the text has exactly one matching item tag.
- No wardrobe reference numbers appear in user-facing text.
`;

                const taggedResult =
                    await callGeminiAPI(
                        null,
                        null,
                        finalPrompt,
                        'text'
                    );
                const result = decodeConsultationTags(taggedResult);
                const references = result?.item_references;
                const uniqueReferences = Array.isArray(references)
                    ? new Set(references)
                    : new Set();
                const validReferences = Array.isArray(references)
                    && references.every(reference =>
                        Number.isInteger(reference)
                        && consultationItems.some(item => item.reference === reference)
                    );
                if (
                    !result?.response
                    || !Array.isArray(references)
                    || uniqueReferences.size !== references.length
                    || !validReferences
                ) {
                    throw new Error("Consultant returned an invalid response format.");
                }

                if (suggestionBox) {

                    suggestionBox.innerHTML =
                        renderAIResponse(result.response, result.item_references);

                    suggestionBox.querySelectorAll('.ai-vibe-row, .ai-vibe-pill').forEach(element => {
                        element.remove();
                    });
                    suggestionBox.onclick = event => {
                        const card = event.target.closest('[data-consultation-reference]');
                        if (!card || !suggestionBox.contains(card)) return;
                        const reference = Number(card.dataset.consultationReference);
                        const item = consultationItems.find(entry => entry.reference === reference);
                        openConsultationItemInspector(item);
                    };
                    suggestionBox.onkeydown = event => {
                        const card = event.target.closest('[data-consultation-reference]');
                        if (!card || (event.key !== 'Enter' && event.key !== ' ')) return;
                        event.preventDefault();
                        const reference = Number(card.dataset.consultationReference);
                        const item = consultationItems.find(entry => entry.reference === reference);
                        openConsultationItemInspector(item);
                    };

                    suggestionBox.classList.remove('hidden');

                    suggestionBox.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
                latestSuggestion = result;
                if (
                    (promptType === 'outfit' || promptType === 'item')
                    && references.length > 0
                ) {
                    saveOutfitBtn?.classList.remove('hidden');
                } else {
                    saveOutfitBtn?.classList.add('hidden');
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
                promptTypeSelect.disabled = false;
            }
        };
    }
});
