// Content script for Facebook / Messenger / VK / Telegram Web (manifest.json): while auto decoding is turned on
// (context menu / hot key, off by default), decodes secret messages under the mouse pointer and shows the private
// message after the public phrase. Pauses while the widget is shown; texts the server says are not secret messages are
// remembered and never sent twice.
window.SecretMessageHoverDecoder = (function () {
    const HOVER_DELAY = 400;
    const MIN_LENGTH = 12;
    // secreteMessagePublicPhraseToText rejects longer phrases.
    const MAX_LENGTH = 5000;
    const CACHE_LIMIT = 500;
    // At most one decode request per second; texts already checked are answered from the cache.
    const REQUEST_INTERVAL = 1000;
    // Same key as AUTO_DECODING_KEY in background.js.
    const AUTO_DECODING_KEY = 'autoDecoding';
    // Marks the private message added to the page, so it is never read as part of a phrase.
    const DECODED_ATTRIBUTE = 'data-secret-message-decoded';
    const DECODED_STYLE = 'margin-left: 0.35em; color: #8b5cf6; font-style: italic; white-space: pre-wrap; ' +
        'text-shadow: 0 0 6px rgba(139, 92, 246, 0.45);';
    // Magic eye in front of the private message: drawn as SVG, so it looks the same with every emoji font, and built
    // from DOM nodes, so no page CSP can block it.
    const MAGIC_EYE_STYLE = 'width: 1.15em; height: 1.15em; margin-right: 0.25em; vertical-align: -0.2em; ' +
        'filter: drop-shadow(0 0 2px rgba(139, 92, 246, 0.6));';
    const MAGIC_EYE = [
        ['path', {d: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z', fill: 'rgba(139, 92, 246, 0.14)',
            stroke: '#7c3aed', 'stroke-width': '1.8', 'stroke-linejoin': 'round'}],
        ['circle', {cx: '12', cy: '12', r: '3.6', fill: '#8b5cf6'}],
        ['circle', {cx: '12', cy: '12', r: '1.5', fill: '#2e1065'}],
        ['circle', {cx: '13.3', cy: '10.7', r: '0.8', fill: '#fff'}],
        ['path', {d: 'M20 .8l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9z', fill: '#f5b700'}]
    ];

    let turnedOn = false;
    let paused = false;
    // Settings saved for this site, until the widget provides its own (possibly unsaved) ones.
    let saved = null;
    let credentials = () => saved;
    let timer = null;
    let pendingPoint = null;
    let running = false;
    let credentialsKey = '';
    let lastRequestAt = 0;
    // Phrase text -> decoded message, or null when it is not a secret message for the current credentials.
    const checked = new Map();

    const active = () => turnedOn && !paused;

    async function loadSaved() {
        try {
            saved = await SecretMessageSettingsStore.load(SECRET_MESSAGE_SETTINGS_KEY);
        } catch (_) {
            saved = null;
        }
    }

    // Settings may have been saved in another tab in the meantime; they are only needed while auto decoding is on.
    function reloadSavedIfOn() {
        if (turnedOn) loadSaved();
    }

    function stop() {
        clearTimeout(timer);
        pendingPoint = null;
    }

    function setTurnedOn(value) {
        turnedOn = value === true;
        if (turnedOn) loadSaved();
        else stop();
    }

    /** @returns {{workspaceId: string, password: string, ownerSignature: string}|null} */
    function currentCredentials() {
        const current = credentials();
        if (!current || !current.workspaceId?.trim() || !current.password) {
            return null;
        }
        const key = JSON.stringify([current.workspaceId, current.password, current.ownerSignature]);
        if (key !== credentialsKey) {
            credentialsKey = key;
            checked.clear();
        }
        return current;
    }

    function textNodeAt(x, y) {
        const range = document.caretRangeFromPoint?.(x, y);
        const node = range?.startContainer;
        // Text inside the widget (shadow DOM) or another shadow tree is not page content.
        if (!node || node.nodeType !== Node.TEXT_NODE || node.getRootNode() !== document) {
            return null;
        }
        // caretRangeFromPoint snaps to the nearest text; require the pointer to be over the text itself.
        const textRange = document.createRange();
        textRange.selectNodeContents(node);
        const hit = [...textRange.getClientRects()].some((rect) =>
            x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
        return hit ? node : null;
    }

    function isExcluded(element) {
        return !!element.closest('[contenteditable=""], [contenteditable="true"], input, textarea, select, script, style, noscript');
    }

    const isInline = (element) => {
        const style = getComputedStyle(element);
        return (style.display === 'inline' || style.display === 'contents') && style.float === 'none' &&
            style.position !== 'absolute' && style.position !== 'fixed';
    };

    // Facebook wraps each emoji image in an inline-flex span; it is part of the line like the image itself.
    const isEmoji = (element) => getComputedStyle(element).display.startsWith('inline') &&
        !element.textContent.trim() && Boolean(element.querySelector('img[alt]'));

    function blockOf(node) {
        for (let element = node.parentElement; element && element !== document.body; element = element.parentElement) {
            if (!isInline(element)) {
                return element;
            }
        }
        return null;
    }

    /**
     * Text of a block as the reader sees it. Emoji drawn as images (Facebook, VK, Telegram) become their alt text.
     * With inlineOnly, nested non-inline elements are skipped: the time and other labels messengers keep inside
     * the same bubble (Telegram).
     */
    function contentOf(block, inlineOnly) {
        const parts = [];
        // The last text or emoji of the phrase: the private message is shown right after it.
        let last = null;
        function walkElement(element) {
            if (element.tagName === 'BR') {
                parts.push('\n');
            } else if (element.tagName === 'IMG') {
                if (element.alt) {
                    parts.push(element.alt);
                    last = element;
                }
            } else if (isInline(element) || isEmoji(element)) {
                walk(element);
            } else if (!inlineOnly && getComputedStyle(element).display !== 'none') {
                parts.push('\n');
                walk(element);
                parts.push('\n');
            }
        }

        function walk(parent) {
            for (const child of parent.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                    parts.push(child.nodeValue);
                    if (child.nodeValue.trim()) last = child;
                } else if (child.nodeType === Node.ELEMENT_NODE &&
                    !child.matches(`script, style, noscript, [${DECODED_ATTRIBUTE}]`)) {
                    walkElement(child);
                }
            }
        }

        walk(block);
        const text = parts.join('')
            .replace(/\u00a0/g, ' ')
            .replace(/[^\S\n]+/g, ' ')
            .replace(/ ?\n ?/g, '\n')
            .replace(/\n{2,}/g, '\n')
            .trim();
        return {element: block, inlineOnly, last, text};
    }

    // The whole block first (a post paragraph, a chat bubble); then only its inline content.
    function candidatesAt(node) {
        const block = blockOf(node);
        // Already shown, unless the page re-rendered the block; then the cached message is shown again without a request.
        if (!block || block.querySelector(`[${DECODED_ATTRIBUTE}]`) || isExcluded(block)) {
            return [];
        }
        const candidates = [contentOf(block, false)];
        const inline = contentOf(block, true);
        if (inline.text !== candidates[0].text) {
            candidates.push(inline);
        }
        return candidates.filter((candidate) => candidate.text.length >= MIN_LENGTH && candidate.text.length <= MAX_LENGTH);
    }

    /**
     * Spellings to look up. The server matches the phrase exactly, but sites drawing emoji as images often drop the
     * invisible U+FE0F after emoji that are plain-text symbols by default (🕷 ❤ ☀), or add one; the generated phrase
     * usually has it.
     */
    function spellings(text) {
        // Emoji minus the keycap bases 0-9 # *; same as \p{Extended_Pictographic} here, which WebStorm doesn't know.
        const withSelectors = text.replace(/[^\P{Emoji}0-9#*](?!\uFE0F)/gu,
            (emoji) => (/\p{Emoji_Presentation}/u.test(emoji) ? emoji : `${emoji}\uFE0F`));
        return [...new Set([text, withSelectors, text.replace(/\uFE0F/g, '')])];
    }

    /**
     * Texts to look up for a candidate: a reply starting with the answered person's name, a link (a VK or Facebook
     * mention), is tried without it first, since "Convert into secret message" keeps the name out of the phrase.
     */
    function phrasesOf(candidate) {
        const name = candidate.element.querySelector('a')?.textContent.trim();
        const rest = name && candidate.text.startsWith(name) ?
            candidate.text.slice(name.length).replace(/^\s*[,:]?\s*/, '') : '';
        return [...new Set([...(rest.length >= MIN_LENGTH ? spellings(rest) : []), ...spellings(candidate.text)])];
    }

    async function decode(text, current) {
        if (checked.has(text)) {
            return checked.get(text);
        }
        // Requests are made one at a time (see schedule), so waiting here keeps the rate across all hovers.
        const wait = lastRequestAt + REQUEST_INTERVAL - Date.now();
        if (wait > 0) {
            await new Promise((resolve) => setTimeout(resolve, wait));
        }
        lastRequestAt = Date.now();
        let message;
        try {
            message = await secreteMessagePublicPhraseToText(text, current.password, current.workspaceId,
                current.ownerSignature || null);
        } catch (error) {
            // Offline, rate limited or a server error: not an answer, so the text is checked again on the next hover.
            if (error instanceof TypeError || /\(HTTP (429|5\d\d)\)/.test(error.message)) {
                return null;
            }
            message = null; // Not a secret message for these credentials.
        }
        if (checked.size >= CACHE_LIMIT) {
            checked.delete(checked.keys().next().value);
        }
        checked.set(text, message);
        return message;
    }

    function magicEye() {
        const svgNs = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNs, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = MAGIC_EYE_STYLE;
        for (const [tag, attributes] of MAGIC_EYE) {
            const shape = document.createElementNS(svgNs, tag);
            Object.entries(attributes).forEach(([name, value]) => shape.setAttribute(name, value));
            svg.append(shape);
        }
        return svg;
    }

    // The public phrase stays untouched; the private message follows it in a mystic violet.
    function showMessage(candidate, message) {
        const span = document.createElement('span');
        span.setAttribute(DECODED_ATTRIBUTE, '');
        span.title = 'Decoded by Secret Message';
        span.style.cssText = DECODED_STYLE;
        span.append(magicEye(), message);
        // After the emoji's wrapper, not inside it: Facebook's is a 16 px box that would squeeze the message to nothing.
        let anchor = candidate.last;
        while (anchor.parentElement !== candidate.element && isEmoji(anchor.parentElement)) anchor = anchor.parentElement;
        anchor.after(span);
    }

    async function processPoint({x, y}) {
        const current = currentCredentials();
        const node = current && textNodeAt(x, y);
        if (!node) {
            return;
        }
        for (const candidate of candidatesAt(node)) {
            for (const phrase of phrasesOf(candidate)) {
                const message = await decode(phrase, current);
                if (message === null) {
                    continue;
                }
                // The widget may have been opened, or the page may have re-rendered the element, during the request.
                if (active() && candidate.element.isConnected &&
                    contentOf(candidate.element, candidate.inlineOnly).text === candidate.text) {
                    showMessage(candidate, message);
                }
                return;
            }
        }
    }

    async function schedule(point) {
        pendingPoint = point;
        if (running) {
            return;
        }
        running = true;
        try {
            while (pendingPoint && active()) {
                const next = pendingPoint;
                pendingPoint = null;
                await processPoint(next);
            }
        } finally {
            running = false;
        }
    }

    window.addEventListener('focus', reloadSavedIfOn);
    chrome.storage.local.get(AUTO_DECODING_KEY).then((stored) => setTurnedOn(stored[AUTO_DECODING_KEY]), () => undefined);
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && AUTO_DECODING_KEY in changes) setTurnedOn(changes[AUTO_DECODING_KEY].newValue);
    });

    document.addEventListener('mousemove', (event) => {
        if (!active()) return;
        clearTimeout(timer);
        timer = setTimeout(() => schedule({x: event.clientX, y: event.clientY}), HOVER_DELAY);
    }, {capture: true, passive: true});

    return Object.freeze({
        // Called by the widget: from then on its current fields are used instead of the saved settings.
        setCredentials(provider) {
            credentials = provider;
            window.removeEventListener('focus', reloadSavedIfOn);
        },
        // Paused while the widget is shown (expanded or collapsed), so it does not change text the user is working with.
        setPaused(value) {
            paused = value;
            if (paused) stop();
        }
    });
})();
