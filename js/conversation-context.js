// What a reply typed in a text box answers, for the history of "Convert into secret message" (the widget's
// convertFocused): the caption of the commented post or the answered comment (sites with comments on posts), or the last
// message of the open chat (chat sites). The selectors come from the page's site (js/sites/); when none matches, the
// history is left as it is.
window.SecretMessageConversationContext = (function () {
    'use strict';

    // Never conversation text: page scripts, buttons ("See more", reactions) and the private messages shown by auto
    // decoding (js/hover-decoder.js).
    const SKIPPED = 'script, style, noscript, button, [role="button"], [data-secret-message-decoded]';

    /**
     * Text as the reader sees it: emoji drawn as images (Facebook, VK, Telegram) become their alt text, line breaks
     * and blocks become new lines. Also reads the private message from a text box with formatting (contenteditable).
     */
    function readableText(element, skip = SKIPPED) {
        let text = '';
        // A block with text starts and ends a line; empty blocks (VK's reaction buttons inside a comment) break nothing.
        let lineBreak = false;
        const add = (part) => {
            if (!part) return;
            if (lineBreak && text && !text.endsWith('\n')) text += '\n';
            lineBreak = false;
            text += part;
        };
        (function walk(parent) {
            for (const child of parent.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                    add(child.nodeValue);
                } else if (child.nodeType !== Node.ELEMENT_NODE || child.matches(skip)) {
                    // Comments and skipped elements.
                } else if (child.tagName === 'BR') {
                    add('\n');
                } else if (child.tagName === 'IMG') {
                    add(child.alt);
                } else {
                    const display = getComputedStyle(child).display;
                    if (display === 'none') continue;
                    const block = !display.startsWith('inline') && display !== 'contents';
                    const before = {length: text.length, lineBreak};
                    if (block) lineBreak = true;
                    walk(child);
                    if (block) lineBreak = text.length > before.length || before.lineBreak;
                }
            }
        })(element);
        return text.replace(/\u00a0/g, ' ').trim();
    }

    // Conversation text on one line per paragraph, without the layout's extra spaces.
    const contextText = (element, skip) => readableText(element, skip)
        .replace(/[^\S\n]+/g, ' ')
        .replace(/ ?\n ?/g, '\n')
        .replace(/\n{2,}/g, '\n');

    const precedes = (element, editor) => Boolean(element.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING);

    const labelOf = (editor) => ['aria-label', 'aria-placeholder', 'placeholder', 'data-placeholder']
        .map((name) => editor.getAttribute(name) ?? '').join(' ');

    // The commenter's name: the site's author element, else the first link with text (the first one is often the avatar).
    function authorOf(site, comment) {
        const author = site.author && comment.querySelector(site.author)?.textContent.trim();
        if (author) return author;
        for (const link of comment.querySelectorAll('a')) {
            const name = link.textContent.trim();
            if (name) return name;
        }
        return '';
    }

    const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // The name a reply starts with, with the comma and spaces after it: VK fills in "Anna, ", Facebook a mention of the
    // full name. Empty when the reply does not start with this name.
    function openerOf(text, name) {
        if (!name) return '';
        const first = escapeRegExp(name.split(/\s+/)[0]);
        return text.match(new RegExp(`^(?:${escapeRegExp(name)}(?![\\p{L}\\p{N}])[,:]?|${first},)\\s*`, 'u'))?.[0] ?? '';
    }

    function answeredComment(site, editor, text) {
        // A reply box inside the comment it answers.
        const around = editor.parentElement?.closest(site.comment);
        if (around) return around;
        const scope = editor.closest(site.post) ?? document.body;
        const comments = [...scope.querySelectorAll(site.comment)].filter((comment) => precedes(comment, editor));
        const named = comments.findLast((comment) => openerOf(text, authorOf(site, comment)));
        if (named) return named;
        // A reply box opened under the comment, inside its thread, labelled "Reply to Anna Smith" (Facebook).
        const label = labelOf(editor);
        if (!site.replyLabel?.test(label)) return null;
        const labelled = comments.findLast((comment) => {
            const author = authorOf(site, comment);
            return author && label.includes(author);
        });
        if (labelled) return labelled;
        for (let element = editor.parentElement; element && element !== scope; element = element.parentElement) {
            const thread = comments.find((comment) => element.contains(comment));
            if (thread) return thread;
        }
        return null;
    }

    function commentText(site, comment) {
        const skip = `${SKIPPED}, ${site.comment}`;
        const all = [...comment.querySelectorAll(site.commentText)]
            .filter((element) => element.closest(site.comment) === comment && !element.closest('a'));
        const outermost = all.filter((element) => !all.some((other) => other !== element && other.contains(element)));
        return outermost.map((element) => contextText(element, skip)).filter(Boolean).join('\n') ||
            contextText(comment, skip);
    }

    // The nearest caption above the text box, unless the climb left the post for the feed (a post without caption).
    function postCaption(site, editor) {
        for (let element = editor.parentElement; element; element = element.parentElement) {
            const captions = [...element.querySelectorAll(site.caption)];
            if (!captions.length) continue;
            if (!element.matches(site.post) && element.querySelectorAll(site.post).length > 1) return '';
            // A shared post has a caption of its own inside the post.
            return captions.map((caption) => contextText(caption)).filter(Boolean).join('\n');
        }
        return '';
    }

    function lastMessage(site) {
        const messages = [...document.querySelectorAll(site.message)];
        for (const message of messages.reverse()) {
            // Other chats stay in the page, hidden.
            if (!message.getClientRects().length) continue;
            const text = contextText(message, `${SKIPPED}, ${site.meta}`);
            if (text) return text;
        }
        return '';
    }

    return Object.freeze({
        readableText,
        /**
         * @param {Element} editor The text box with the reply.
         * @param {string} text Its text.
         * @returns {{context: {kind: 'post' | 'comment' | 'message', text: string} | null, opener: string}} What the
         * reply answers, and the name of the answered commenter the reply starts with (kept out of the secret).
         */
        find(editor, text) {
            const site = SecretMessageSites.forHost();
            if (site.message) {
                const message = lastMessage(site);
                return {context: message ? {kind: 'message', text: message} : null, opener: ''};
            }
            if (!site.comment) return {context: null, opener: ''};
            const comment = answeredComment(site, editor, text);
            const opener = comment ? openerOf(text, authorOf(site, comment)) : '';
            const answered = comment ? commentText(site, comment) : '';
            if (answered) return {context: {kind: 'comment', text: answered}, opener};
            const caption = postCaption(site, editor);
            return {context: caption ? {kind: 'post', text: caption} : null, opener};
        }
    });
})();
