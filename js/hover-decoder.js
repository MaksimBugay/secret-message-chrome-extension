// Decodes secret messages under the mouse pointer and replaces the public phrase with the original text.
// Runs on pages where js/auto-decoder.js enables it and pauses while the widget is shown; texts that are not secret
// messages are remembered and never sent twice.
window.SecretMessageHoverDecoder = (function () {
    const HOVER_DELAY = 400;
    const MIN_LENGTH = 12;
    // secreteMessagePublicPhraseToText rejects longer phrases.
    const MAX_LENGTH = 5000;
    const CACHE_LIMIT = 500;
    // At most one decode request per second; texts already checked are answered from the cache.
    const REQUEST_INTERVAL = 1000;
    const DECODED_PREFIX = '🔓 ';

    let started = false;
    let paused = false;
    let options = {credentials: () => null};
    let timer = null;
    let pendingPoint = null;
    let running = false;
    let credentialsKey = '';
    let lastRequestAt = 0;
    // Phrase text -> decoded message, or null when it is not a secret message for the current credentials.
    const checked = new Map();
    const decodedElements = new WeakSet();

    const enabled = () => started && !paused;

    function currentCredentials() {
        const credentials = options.credentials();
        if (!credentials || !credentials.workspace?.trim() || !credentials.password) {
            return null;
        }
        const key = JSON.stringify([credentials.workspace, credentials.password, credentials.ownerSignature]);
        if (key !== credentialsKey) {
            credentialsKey = key;
            checked.clear();
        }
        return credentials;
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
        const nodes = [];
        const images = [];
        function walkElement(element) {
            if (element.tagName === 'BR') {
                parts.push('\n');
            } else if (element.tagName === 'IMG') {
                if (element.alt) {
                    parts.push(element.alt);
                    images.push(element);
                }
            } else if (isInline(element)) {
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
                    nodes.push(child);
                } else if (child.nodeType === Node.ELEMENT_NODE && !child.matches('script, style, noscript')) {
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
        return {element: block, nodes, images, text};
    }

    // The whole block first (a post paragraph, a chat bubble); then only its inline content.
    function candidatesAt(node) {
        const block = blockOf(node);
        if (!block || decodedElements.has(block) || isExcluded(block)) {
            return [];
        }
        const candidates = [contentOf(block, false)];
        const inline = contentOf(block, true);
        if (inline.text !== candidates[0].text) {
            candidates.push(inline);
        }
        return candidates.filter((candidate) => candidate.text.length >= MIN_LENGTH && candidate.text.length <= MAX_LENGTH);
    }

    async function decode(text, credentials) {
        if (checked.has(text)) {
            return checked.get(text);
        }
        // Requests are made one at a time (see schedule), so waiting here keeps the rate across all hovers.
        const wait = lastRequestAt + REQUEST_INTERVAL - Date.now();
        if (wait > 0) {
            await new Promise((resolve) => setTimeout(resolve, wait));
        }
        lastRequestAt = Date.now();
        let message = null;
        try {
            message = await secreteMessagePublicPhraseToText(text, credentials.password, credentials.workspace,
                credentials.ownerSignature || null);
        } catch (_) {
            // Not a secret message for these credentials.
        }
        if (checked.size >= CACHE_LIMIT) {
            checked.delete(checked.keys().next().value);
        }
        checked.set(text, message);
        return message;
    }

    // Text node values change and emoji images are hidden, so pages rendered by React keep their DOM structure.
    function replaceText(candidate, message) {
        const [first, ...rest] = candidate.nodes;
        let target = first;
        if (!target) {
            target = document.createTextNode('');
            candidate.images[0].before(target);
        }
        target.nodeValue = DECODED_PREFIX + message;
        rest.forEach((node) => { node.nodeValue = ''; });
        candidate.images.forEach((image) => { image.style.display = 'none'; });
        const element = candidate.element;
        element.dataset.secretMessageDecoded = 'true';
        element.title = 'Decoded by Secret Message';
        element.style.whiteSpace = 'pre-wrap';
        element.style.backgroundColor = 'rgba(124, 77, 255, 0.12)';
        element.style.borderRadius = '6px';
        decodedElements.add(element);
    }

    async function processPoint({x, y}) {
        const credentials = currentCredentials();
        const node = credentials && textNodeAt(x, y);
        if (!node) {
            return;
        }
        for (const candidate of candidatesAt(node)) {
            const message = await decode(candidate.text, credentials);
            if (message === null) {
                continue;
            }
            // The widget may have been opened, or the page may have re-rendered the element, during the request.
            const inlineOnly = candidate.text !== contentOf(candidate.element, false).text;
            if (enabled() && candidate.element.isConnected &&
                contentOf(candidate.element, inlineOnly).text === candidate.text) {
                replaceText(candidate, message);
            }
            return;
        }
    }

    async function schedule(point) {
        pendingPoint = point;
        if (running) {
            return;
        }
        running = true;
        try {
            while (pendingPoint && enabled()) {
                const next = pendingPoint;
                pendingPoint = null;
                await processPoint(next);
            }
        } finally {
            running = false;
        }
    }

    document.addEventListener('mousemove', (event) => {
        if (!enabled()) return;
        clearTimeout(timer);
        timer = setTimeout(() => schedule({x: event.clientX, y: event.clientY}), HOVER_DELAY);
    }, {capture: true, passive: true});

    return Object.freeze({
        /** @param {{credentials: function(): ({workspace: string, password: string, ownerSignature: string}|null)}} config */
        configure(config) {
            options = {...options, ...config};
        },
        // Called by js/auto-decoder.js on Facebook / VK / Telegram page load.
        start() {
            started = true;
        },
        // Paused while the widget is shown (expanded or collapsed), so it does not change text the user is working with.
        setPaused(value) {
            paused = value;
            if (paused) {
                clearTimeout(timer);
                pendingPoint = null;
            }
        }
    });
})();
