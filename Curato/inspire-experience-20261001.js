const WISHLIST_KEY = 'curato-inspire-wishlist';
const STYLE_KEY = 'curato-inspire-style';
const BRANDS_KEY = 'curato-inspire-brands';
const PRODUCT_CATEGORIES = new Set(['Top', 'Bottom', 'Outerwear', 'Shoes', 'Bag', 'Accessory']);
const CATEGORY_PAIRINGS = {
    Top: ['bottom', 'shoe'],
    Bottom: ['top', 'shoe'],
    Outerwear: ['top', 'bottom'],
    Shoes: ['top', 'bottom'],
    Bag: ['top', 'bottom'],
    Accessory: ['top', 'bottom']
};

let products = [];
let wishlist = [];
let wardrobeProvider = () => [];
let activeStyle = 'all';
let lastError = '';
let searchInProgress = false;

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function readJson(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        console.error(`Unable to read Inspire data (${key}):`, error);
        return fallback;
    }
}

function contextFromForm() {
    const limit = Number(document.getElementById('inspire-result-limit')?.value || 6);
    return {
        search: document.getElementById('inspire-search')?.value.trim() || '',
        category: document.getElementById('inspire-category')?.value || 'All',
        limit: [6, 9, 12].includes(limit) ? limit : 6,
        brands: document.getElementById('inspire-brands')?.value.trim() || '',
        style: activeStyle
    };
}

function googleImagesUrl(product, proposedUrl = '') {
    try {
        const url = new URL(proposedUrl);
        const queryWords = new Set(productTokens(url.searchParams.get('q')));
        const expectedWords = [...productTokens(product.name), ...productTokens(product.retailer)];
        if (url.protocol === 'https:'
            && ['google.com', 'www.google.com'].includes(url.hostname.toLowerCase())
            && url.pathname === '/search'
            && url.searchParams.get('tbm') === 'isch'
            && expectedWords.length > 0
            && expectedWords.every(word => queryWords.has(word))) return url.toString();
    } catch (_) {
        // Build a product-specific Google Images query when the model link is invalid.
    }
    return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent([product.name, product.retailer].filter(Boolean).join(' '))}`;
}

function safeProductUrl(value) {
    try {
        const url = new URL(value);
        const path = url.pathname.toLowerCase();
        const parts = path.split('/').filter(Boolean);
        const last = parts[parts.length - 1] || '';
        return url.protocol === 'https:'
            && (!/(^|\.)google\.com$/i.test(url.hostname) || isGroundingRedirect(url.toString()))
            && !/googleadservices\.com$/i.test(url.hostname)
            && parts.length > 0
            && last.length > 2
            && !/^(men|women|kids|sale|new-in|clothing|accessories|shoes|bags|home|search|collections?|categories?)$/i.test(last)
            && !/\/(?:search|collections?|categories?)(?:\/|$)/i.test(path)
            && !/^\/products?\/?$/i.test(path);
    } catch (_) {
        return false;
    }
}

function stripTrackingParams(value) {
    const url = new URL(value);
    [...url.searchParams.keys()].forEach(key => {
        if (/^(utm_.*|gclid|fbclid|affiliate|ref)$/i.test(key)) url.searchParams.delete(key);
    });
    return url.toString();
}

function retailerPageUrl(value) {
    try {
        const url = new URL(value);
        if (/(^|\.)google\.com$/i.test(url.hostname) && url.pathname === '/url') {
            const destination = url.searchParams.get('url') || url.searchParams.get('q');
            if (!destination) return '';
            const retailerUrl = new URL(stripTrackingParams(destination));
            return safeProductUrl(retailerUrl.toString()) ? retailerUrl.toString() : '';
        }
        if (url.hostname.toLowerCase() === 'vertexaisearch.cloud.google.com'
            && url.pathname.toLowerCase().startsWith('/grounding-api-redirect/')) {
            return url.toString();
        }
        const cleanUrl = stripTrackingParams(url.toString());
        return safeProductUrl(cleanUrl) ? cleanUrl : '';
    } catch (_) {
        return '';
    }
}

function productTokens(value) {
    return (String(value || '').toLowerCase().match(/[a-z0-9]+/g) || [])
        .filter(token => token.length > 2 && !['the', 'with', 'from', 'and', 'for'].includes(token));
}

function isGroundingRedirect(value) {
    try {
        const url = new URL(value);
        return url.hostname.toLowerCase() === 'vertexaisearch.cloud.google.com'
            && url.pathname.toLowerCase().startsWith('/grounding-api-redirect/');
    } catch (_) {
        return false;
    }
}

function isSameRetailer(first, second) {
    try {
        const firstHost = new URL(first).hostname.toLowerCase().replace(/^www\./, '');
        const secondHost = new URL(second).hostname.toLowerCase().replace(/^www\./, '');
        return firstHost === secondHost;
    } catch (_) {
        return false;
    }
}

function titleMatchesProduct(title, name, allowLooseMatch = false) {
    const nameWords = new Set(productTokens(name));
    const titleWords = new Set(productTokens(title));
    if (!nameWords.size || !titleWords.size) return false;
    const overlap = [...nameWords].filter(word => titleWords.has(word)).length;
    const required = allowLooseMatch
        ? Math.min(2, Math.max(1, Math.ceil(nameWords.size * 0.3)))
        : Math.min(2, Math.max(1, Math.ceil(nameWords.size * 0.25)));
    return overlap >= required;
}

function stronglyMatchesProductTitle(title, name) {
    const nameWords = new Set(productTokens(name));
    const titleWords = new Set(productTokens(title));
    return nameWords.size > 0
        && [...nameWords].filter(word => titleWords.has(word)).length >= Math.min(2, nameWords.size);
}

function productSourceFor(product, sources) {
    let productUrl = null;
    try { productUrl = new URL(product.url); } catch (_) {}
    const nameTokens = new Set(productTokens(product.name));
    const exact = productUrl && sources.find(source => {
        let citedUrl;
        try {
            citedUrl = new URL(source.url);
        } catch (_) {
            return false;
        }
        if (!safeProductUrl(source.url)) return false;
        return isSameRetailer(source.url, product.url)
            && citedUrl.pathname.replace(/\/$/, '').toLowerCase() === productUrl.pathname.replace(/\/$/, '').toLowerCase();
    });
    if (exact) return exact;
    return sources.find(source => {
        if (!safeProductUrl(source.url)) return false;
        const sameRetailer = productUrl && isSameRetailer(source.url, product.url);
        const groundingRedirect = isGroundingRedirect(source.url);
        const nameMatch = titleMatchesProduct(source.title, product.name, groundingRedirect);
        if (!sameRetailer && !groundingRedirect && !(nameMatch && isSpecificCitedPage(source))) return false;
        if (nameMatch) return true;
        if (!sameRetailer) return false;
        let citedUrl;
        try {
            citedUrl = new URL(source.url);
        } catch (_) {
            return false;
        }
        const titleTokens = new Set(productTokens(source.title));
        const pathTokens = new Set(productTokens(citedUrl.pathname.replace(/[-_/]+/g, ' ')));
        const overlap = tokenSet => [...nameTokens].filter(token => tokenSet.has(token)).length;
        const titleMatch = nameTokens.size > 0 && overlap(titleTokens) >= Math.min(2, Math.ceil(nameTokens.size * 0.45));
        const pathMatch = nameTokens.size > 0 && overlap(pathTokens) >= Math.min(2, Math.ceil(nameTokens.size * 0.55));
        return sameRetailer && (titleMatch || pathMatch);
    }) || null;
}

function isSpecificCitedPage(source) {
    if (!source.title || !safeProductUrl(source.url)) return false;
    const titleWords = new Set(productTokens(source.title));
    let url;
    try {
        url = new URL(source.url);
    } catch (_) {
        return false;
    }
    const path = url.pathname.toLowerCase();
    const pathWords = new Set(productTokens(path.replace(/[-_/]+/g, ' ')));
    const overlap = [...titleWords].filter(word => pathWords.has(word)).length;
    if (isGroundingRedirect(source.url)) return titleWords.size >= 2;
    const productRoute = /(?:^|\/)(?:products?|dp|item|sku|product-detail)(?:\/|$)/i.test(path);
    return titleWords.size >= 2 && (productRoute || overlap >= Math.min(2, titleWords.size));
}

function normaliseProduct(product, sources, context, index) {
    const name = String(product?.product || product?.name || product?.title || product?.productName || '').trim();
    const url = retailerPageUrl(String(product?.link || product?.url || product?.productUrl || product?.product_url || '').trim());
    if (!name) return null;
    const source = productSourceFor({ name, url }, sources);
    if (!source) return null;
    const retailer = (isGroundingRedirect(source.url)
        ? String(product.retailer || product.store || source.title || 'Retailer').split(/\s+[|–—:-]\s+/)[0]
        : new URL(source.url).hostname.replace(/^www\./, '')).slice(0, 60);
    const category = PRODUCT_CATEGORIES.has(product.category)
        ? product.category
        : (context.category === 'All' ? 'Style find' : context.category);
    return {
        id: `find-${encodeURIComponent(source.url).replace(/%/g, '').slice(-48)}`,
        name: name.slice(0, 120),
        retailer,
        url: source.url,
        price: String(product.price || '').slice(0, 40),
        category,
        reason: String(product.reason || 'A retailer product page verified in Google Search.').slice(0, 180),
        imageSearchUrl: googleImagesUrl({ name, retailer }),
        index
    };
}

function normaliseCitedSource(source, context, index, suggestedProducts = []) {
    const title = String(source.title || '').trim();
    const url = retailerPageUrl(source.url);
    if (!title || !url || !isSpecificCitedPage({ ...source, url })) return null;
    const suggestedProduct = suggestedProducts.find(product =>
        stronglyMatchesProductTitle(title, String(product?.product || product?.name || product?.title || ''))
    );
    if (suggestedProduct) {
        return normaliseProduct({ ...suggestedProduct, link: url }, [source], context, index);
    }
    let retailer;
    try {
        retailer = isGroundingRedirect(url)
            ? title.split(/\s+[|–—:-]\s+/)[0].slice(0, 60)
            : new URL(url).hostname.replace(/^www\./, '');
    } catch (_) {
        return null;
    }
    return normaliseProduct({
        product: title,
        link: url,
        retailer,
        category: context.category === 'All' ? 'Style find' : context.category,
        reason: 'Retailer page cited by Google Search.'
    }, [source], context, index);
}

function parseProducts(text) {
    const cleaned = String(text || '').replace(/```(?:json)?/gi, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('The product search returned an unreadable response. Please try again.');
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const list = Array.isArray(parsed) ? parsed : parsed.products;
    if (!Array.isArray(list)) throw new Error('The product search returned no product list. Please try again.');
    return list;
}

async function searchProducts(context, supabase) {
    const keyInput = document.getElementById('user-api-key');
    const modelSelect = document.getElementById('model-select');
    const { data: { session } } = await supabase.auth.getSession();
    const key = keyInput?.value.trim() || session?.user?.user_metadata?.gemini_api_key;
    const model = modelSelect?.value || session?.user?.user_metadata?.preferred_model || 'gemini-2.0-flash';
    if (!key) throw new Error('Add a Gemini API key in Account settings to search products.');

    const prompt = `Find up to ${context.limit} relevant fashion products for this request: "${context.search || 'versatile wardrobe additions'}". Item type: ${context.category}. Style direction: ${context.style === 'all' ? 'any' : context.style}. ${context.brands ? `Prioritise these brands: ${context.brands}.` : ''}

Use Google Search. Return only JSON: {"products":[{"product":"exact product name","link":"URL copied from a cited retailer product page","google_image_link":"Google Images search URL for this exact product and retailer","retailer":"retailer name","price":"visible price or empty string","category":"Top|Bottom|Outerwear|Shoes|Bag|Accessory","reason":"short reason tied to the request"}]}. Only include a product when its product page is among the Google Search grounding sources; use the exact cited URL, never invent or rewrite URLs. Image links must search for the exact product and retailer. Never guess product names, stock or prices. Exclude search pages, category pages, marketplaces and unavailable items. Prioritise relevance to the request over filling the result limit; return fewer rather than unrelated products.`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 4000 }
        })
    });
    let result;
    try {
        result = await response.json();
    } catch (error) {
        console.error('Inspire received a non-JSON search response:', error);
        throw new Error('The product search returned an unreadable response. Please try again.');
    }
    if (!response.ok) throw new Error(result.error?.message || 'The product search failed. Please try again.');
    const candidates = result.candidates || [];
    const sources = candidates.flatMap(candidate => candidate.groundingMetadata?.groundingChunks || [])
        .map(chunk => ({ url: retailerPageUrl(chunk.web?.uri || ''), title: chunk.web?.title }))
        .filter((source, index, list) => source.url && list.findIndex(item => item.url === source.url) === index);
    const text = candidates
        .map(candidate => (candidate.content?.parts || []).map(part => part.text || '').join(''))
        .find(value => value.trim()) || '';
    let parsed;
    try {
        parsed = parseProducts(text);
    } catch (error) {
        if (!sources.some(isSpecificCitedPage)) throw error;
        console.warn('Inspire used verified retailer citations because the model response was not structured.');
        parsed = [];
    }
    const found = [];
    const seenUrls = new Set();
    parsed.forEach((item, index) => {
        const normalized = normaliseProduct(item, sources, context, index);
        if (!normalized || seenUrls.has(normalized.url)) return;
        seenUrls.add(normalized.url);
        found.push(normalized);
    });
    sources.forEach((source, index) => {
        if (found.length >= context.limit) return;
        const citedProduct = normaliseCitedSource(source, context, index, parsed);
        if (!citedProduct || seenUrls.has(citedProduct.url)) return;
        seenUrls.add(citedProduct.url);
        found.push(citedProduct);
    });
    if (!found.length) {
        throw new Error('Search returned no retailer product pages we could verify. Try a specific item or brand.');
    }
    return found.slice(0, context.limit);
}

function validWishlist(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(item => item
        && typeof item.id === 'string'
        && typeof item.name === 'string'
        && safeProductUrl(item.url));
}

function pairingCandidates(product) {
    const wanted = CATEGORY_PAIRINGS[product.category] || ['top', 'bottom'];
    return (wardrobeProvider() || []).filter(item => {
        const category = `${item.tags?.subcategory || ''} ${item.tags?.category || ''}`.toLowerCase();
        return wanted.some(value => category.includes(value));
    });
}

function buildPairings(product, usage, productNumber) {
    const candidates = pairingCandidates(product);
    const categoryOrder = CATEGORY_PAIRINGS[product.category] || ['top', 'bottom'];
    const selected = [];
    const choose = pool => pool
        .filter(item => !selected.some(entry => String(entry.id) === String(item.id)))
        .sort((first, second) => {
            const firstUses = usage.get(String(first.id)) || 0;
            const secondUses = usage.get(String(second.id)) || 0;
            if (firstUses !== secondUses) return firstUses - secondUses;
            const rotate = (item, list) => (list.indexOf(item) - productNumber + list.length) % list.length;
            return rotate(first, candidates) - rotate(second, candidates);
        })[0];
    if (candidates.length <= 2) {
        const item = choose(candidates);
        if (item) usage.set(String(item.id), (usage.get(String(item.id)) || 0) + 1);
        return item ? [item] : [];
    }
    categoryOrder.forEach(category => {
        const item = choose(candidates.filter(candidate =>
            `${candidate.tags?.subcategory || ''} ${candidate.tags?.category || ''}`.toLowerCase().includes(category)
        ));
        if (item) selected.push(item);
    });
    while (selected.length < 2) {
        const item = choose(candidates);
        if (!item) break;
        selected.push(item);
    }
    selected.forEach(item => usage.set(String(item.id), (usage.get(String(item.id)) || 0) + 1));
    return selected;
}

function productImageTile(product) {
    const icon = {
        Top: 'fa-shirt',
        Bottom: 'fa-person',
        Outerwear: 'fa-shirt',
        Shoes: 'fa-shoe-prints',
        Bag: 'fa-bag-shopping',
        Accessory: 'fa-gem'
    }[product.category] || 'fa-wand-magic-sparkles';
    return `<a class="inspire-product-visual inspire-visual-${escapeHTML(product.category.toLowerCase().replace(/[^a-z]/g, ''))}" href="${escapeHTML(product.imageSearchUrl || googleImagesUrl(product))}" target="_blank" rel="noopener noreferrer" aria-label="Find photos of ${escapeHTML(product.name)} by ${escapeHTML(product.retailer)}">
        <span class="inspire-photo-label"><i class="fa-regular fa-images" aria-hidden="true"></i> Product photo search</span>
        <span class="inspire-photo-emblem" aria-hidden="true"><i class="fa-solid ${icon}"></i><i class="fa-solid fa-sparkles"></i></span>
        <span class="inspire-visual-name">${escapeHTML(product.name)}</span>
        <span class="inspire-visual-link">See photos <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span>
    </a>`;
}

function renderPairings(pairings) {
    if (!pairings.length) return `<div class="inspire-pairing-empty"><i class="fa-solid fa-shirt" aria-hidden="true"></i><span>Add wardrobe items to see outfit pairings here.</span></div>`;
    return `<div class="inspire-pairing-list">${pairings.map(item => `<span class="inspire-pairing-item">
        <img src="${escapeHTML(item.image_url || '')}" alt="" loading="lazy">
        <span><strong>${escapeHTML(item.name)}</strong><small>From your wardrobe</small></span>
    </span>`).join('')}</div>`;
}

function renderProducts() {
    const grid = document.getElementById('inspire-grid');
    const count = document.getElementById('inspire-results-count');
    if (!grid || !count) return;
    count.textContent = products.length
        ? `${products.length} verified ${products.length === 1 ? 'find' : 'finds'}`
        : '';
    if (lastError) {
        grid.innerHTML = `<section class="inspire-message inspire-message-error" role="alert">
            <span class="inspire-message-icon"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></span>
            <div><h3>We couldn't find a verified match</h3><p>${escapeHTML(lastError)}</p><button type="button" class="inspire-retry" data-inspire-retry><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Try again</button></div>
        </section>`;
        return;
    }
    if (!products.length) {
        grid.innerHTML = `<section class="inspire-message inspire-message-empty">
            <span class="inspire-message-icon"><i class="fa-solid fa-sparkles" aria-hidden="true"></i></span>
            <div><h3>Your next favourite starts here</h3><p>Tell us what you’re looking for. We’ll return only products with a retailer page we can verify.</p></div>
        </section>`;
        return;
    }
    const usage = new Map();
    grid.innerHTML = products.map((product, index) => {
        const saved = wishlist.some(item => item.id === product.id);
        const pairings = buildPairings(product, usage, index);
        return `<article class="inspire-product-card">
            ${productImageTile(product)}
            <div class="inspire-product-content">
                <div class="inspire-product-meta"><span>${escapeHTML(product.retailer)}</span><span>${escapeHTML(product.category)}</span></div>
                <h3>${escapeHTML(product.name)}</h3>
                ${product.price ? `<p class="inspire-product-price">${escapeHTML(product.price)}</p>` : ''}
                <p class="inspire-product-reason">${escapeHTML(product.reason)}</p>
                <section class="inspire-pairing-box" aria-label="Wardrobe pairings">
                    <div class="inspire-pairing-heading"><i class="fa-solid fa-link" aria-hidden="true"></i><span>Pair it with</span></div>
                    ${renderPairings(pairings)}
                </section>
                <div class="inspire-product-actions">
                    <a class="inspire-shop-link" href="${escapeHTML(product.url)}" target="_blank" rel="noopener noreferrer">Shop this piece <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
                    <button class="inspire-save-button" type="button" data-inspire-save="${escapeHTML(product.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from' : 'Save to'} wishlist">
                        <i class="fa-${saved ? 'solid' : 'regular'} fa-heart" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
        </article>`;
    }).join('');
}

function renderWishlist() {
    const grid = document.getElementById('inspire-wishlist-list');
    const empty = document.getElementById('inspire-wishlist-empty');
    const count = document.getElementById('inspire-wishlist-count');
    if (count) count.textContent = String(wishlist.length);
    if (empty) empty.classList.toggle('hidden', wishlist.length > 0);
    if (!grid) return;
    grid.innerHTML = wishlist.map(item => `<article class="inspire-wishlist-card">
        <a class="inspire-wishlist-image" href="${escapeHTML(googleImagesUrl(item))}" target="_blank" rel="noopener noreferrer" aria-label="View ${escapeHTML(item.name)} images">
            <i class="fa-regular fa-images" aria-hidden="true"></i><span>Images</span>
        </a>
        <div class="inspire-wishlist-content"><p class="eyebrow">${escapeHTML(item.retailer || 'Saved find')}</p><h3>${escapeHTML(item.name)}</h3>
            <div class="inspire-product-actions">
                <a class="inspire-shop-link" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">Shop this piece</a>
                <button type="button" class="inspire-remove-button" data-inspire-remove="${escapeHTML(item.id)}">Remove</button>
            </div>
        </div>
    </article>`).join('');
}

function setStatus(message, state = '') {
    const status = document.getElementById('inspire-search-status');
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
    status.classList.toggle('hidden', !message);
}

function clearStaleResults(message) {
    products = [];
    lastError = '';
    setStatus(message);
    renderProducts();
}

function setLoading(loading) {
    searchInProgress = loading;
    const button = document.getElementById('refresh-inspire');
    if (!button) return;
    document.querySelectorAll('#inspire-search, #inspire-category, #inspire-result-limit, #inspire-brands, [data-inspire-style]')
        .forEach(control => { control.disabled = loading; });
    button.disabled = loading;
    button.innerHTML = loading
        ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Finding your edit'
        : '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Find my edit';
    button.setAttribute('aria-busy', String(loading));
}

async function runSearch(supabase) {
    if (searchInProgress) return;
    const context = contextFromForm();
    if (!context.search) {
        lastError = 'Add a short description first, such as “black leather loafers” or “light jacket for spring”.';
        setStatus('', 'error');
        renderProducts();
        document.getElementById('inspire-search')?.focus();
        return;
    }
    products = [];
    lastError = '';
    renderProducts();
    setLoading(true);
    setStatus('Searching retailers and checking each product page…', 'loading');
    const grid = document.getElementById('inspire-grid');
    if (grid) grid.innerHTML = `<div class="inspire-loading"><span class="inspire-spinner"></span><strong>Finding pieces worth a closer look</strong><span>Checking retailer pages before showing results.</span></div>`;
    try {
        products = await searchProducts(context, supabase);
        setStatus(`${products.length} verified ${products.length === 1 ? 'product' : 'products'} · availability may change at the retailer.`, 'success');
    } catch (error) {
        console.error('Inspire search failed:', error);
        lastError = error instanceof Error ? error.message : 'The product search failed. Please try again.';
        setStatus('', 'error');
    } finally {
        setLoading(false);
        renderProducts();
    }
}

export function refreshInspireWardrobe() {
    if (document.getElementById('inspire-grid')) renderProducts();
}

export function initializeInspire(supabase, getWardrobeItems) {
    wardrobeProvider = getWardrobeItems;
    try {
        activeStyle = localStorage.getItem(STYLE_KEY) || 'all';
    } catch (error) {
        console.error('Unable to read the Inspire style preference:', error);
        activeStyle = 'all';
    }
    if (!['all', 'masculine', 'feminine'].includes(activeStyle)) activeStyle = 'all';
    wishlist = validWishlist(readJson(WISHLIST_KEY, []));
    const brands = document.getElementById('inspire-brands');
    if (brands) {
        try {
            brands.value = localStorage.getItem(BRANDS_KEY) || '';
        } catch (error) {
            console.error('Unable to read Inspire brand preferences:', error);
            setStatus('Your brand preferences could not be loaded from this browser.', 'error');
        }
    }
    document.querySelectorAll('[data-inspire-style]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.inspireStyle === activeStyle));
        button.addEventListener('click', () => {
            activeStyle = button.dataset.inspireStyle || 'all';
            document.querySelectorAll('[data-inspire-style]').forEach(choice =>
                choice.setAttribute('aria-pressed', String(choice === button))
            );
            clearStaleResults('Style direction changed. Find my edit to refresh your results.');
            try {
                localStorage.setItem(STYLE_KEY, activeStyle);
            } catch (error) {
                console.error('Unable to save the Inspire style preference:', error);
                setStatus('The style preference could not be saved in this browser.', 'error');
            }
        });
    });
    renderProducts();
    renderWishlist();

    document.getElementById('refresh-inspire')?.addEventListener('click', () => runSearch(supabase));
    document.getElementById('inspire-search')?.addEventListener('input', () => {
        clearStaleResults('Search changed. Find my edit to refresh your results.');
    });
    ['inspire-category', 'inspire-result-limit'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            clearStaleResults('Filters changed. Find my edit to refresh your results.');
        });
    });
    document.getElementById('inspire-search')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            runSearch(supabase);
        }
    });
    brands?.addEventListener('change', () => {
        clearStaleResults('Brand preferences changed. Find my edit to refresh your results.');
        try {
            localStorage.setItem(BRANDS_KEY, brands.value.trim());
        } catch (error) {
            console.error('Unable to save Inspire brand preferences:', error);
            setStatus('Brand preferences could not be saved in this browser.', 'error');
        }
    });
    window.addEventListener('curato:wardrobe-updated', refreshInspireWardrobe);
    document.getElementById('inspire-grid')?.addEventListener('click', event => {
        if (event.target.closest('[data-inspire-retry]')) {
            runSearch(supabase);
            return;
        }
        const button = event.target.closest('[data-inspire-save]');
        if (!button) return;
        const product = products.find(item => item.id === button.dataset.inspireSave);
        if (!product) return;
        const alreadySaved = wishlist.some(item => item.id === product.id);
        const nextWishlist = alreadySaved
            ? wishlist.filter(item => item.id !== product.id)
            : [...wishlist, product];
        try {
            localStorage.setItem(WISHLIST_KEY, JSON.stringify(nextWishlist));
            wishlist = nextWishlist;
            renderProducts();
            renderWishlist();
        } catch (error) {
            console.error('Unable to save the Inspire wishlist:', error);
            setStatus('Your wishlist could not be saved in this browser.', 'error');
        }
    });
    document.getElementById('inspire-wishlist-list')?.addEventListener('click', event => {
        const button = event.target.closest('[data-inspire-remove]');
        if (!button) return;
        const nextWishlist = wishlist.filter(item => item.id !== button.dataset.inspireRemove);
        try {
            localStorage.setItem(WISHLIST_KEY, JSON.stringify(nextWishlist));
            wishlist = nextWishlist;
            renderProducts();
            renderWishlist();
        } catch (error) {
            console.error('Unable to update the Inspire wishlist:', error);
            setStatus('Your wishlist could not be updated in this browser.', 'error');
        }
    });
    const modal = document.getElementById('inspire-wishlist-modal');
    document.getElementById('open-inspire-wishlist')?.addEventListener('click', () => {
        renderWishlist();
        modal?.classList.remove('hidden');
        modal?.classList.add('flex');
    });
    document.querySelectorAll('[data-close-inspire-wishlist]').forEach(button => {
        button.addEventListener('click', () => {
            modal?.classList.add('hidden');
            modal?.classList.remove('flex');
        });
    });
}
