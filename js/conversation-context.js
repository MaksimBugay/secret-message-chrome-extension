// What a reply typed in a text box answers, for the history of "Convert into secret message" (the widget's
// convertFocused): the caption of the commented post or the answered comment (Facebook, VK), or the last message of the
// open chat (Telegram Web). Site markup changes often: each site lists the selectors known to work, and when none
// matches the history is left as it is.
window.SecretMessageConversationContext = (function () {
    'use strict';

    // Never conversation text: page scripts, buttons ("See more", reactions) and the private messages shown by auto
    // decoding (js/hover-decoder.js).
    const SKIPPED = 'script, style, noscript, button, [role="button"], [data-secret-message-decoded]';
    // Labels of reply boxes: "Reply to Anna", "Write a reply…", "Ответить", "Відповісти", "Antworten", "Répondre"…
    const REPLY_LABEL = /reply|answer|respon|répon|antwort|rispon|ответ|відпов|odpowi/i;

    const SITES = [
        {
            host: /(^|\.)facebook\.com$/i,
            // Feed and group posts, and a post opened in a dialog.
            post: '[aria-posinset], [role="article"]:not([aria-label]), [role="dialog"]',
            caption: '[data-ad-rendering-role="story_message"], [data-ad-comet-preview="message"], [data-ad-preview="message"]',
            // Comments and replies are articles labelled "Comment by …" / "Reply by …".
            comment: '[role="article"][aria-label]',
            commentText: 'div[dir="auto"]'
        },
        {
            host: /(^|\.)vk\.(com|ru)$/i,
            // The redesigned site (test ids; comments are in the post popup) and the old one (classes).
            post: '[data-testid="post"], .post, ._post',
            caption: '[data-testid="post_text"] [data-testid="showmoretext"], .wall_post_text',
            comment: '[data-testid="wall_comments_comment_root"], [data-testid="wall_comments_comment_in_thread"], .reply',
            commentText: '[data-testid="comment-text"], .wall_reply_text, .reply_text',
            author: '[data-testid="comment-owner"], .author'
        },
        {
            host: /^web\.telegram\.org$/i,
            // Telegram Web K (/k/) and A (/a/); the time, reactions and quoted replies are inside the message.
            message: '.bubble .message, .Message .text-content',
            meta: '.time, .MessageMeta, .reactions, .Reactions, .reply, .EmbeddedMessage'
        }
    ];

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

    // VK starts a reply with "Name, ", Facebook with a mention of the full name.
    function startsWithName(text, name) {
        if (!name) return false;
        return text.startsWith(name) || text.startsWith(`${name.split(/\s+/)[0]},`);
    }

    function answeredComment(site, editor, text) {
        // A reply box inside the comment it answers.
        const around = editor.parentElement?.closest(site.comment);
        if (around) return around;
        const scope = editor.closest(site.post) ?? document.body;
        const comments = [...scope.querySelectorAll(site.comment)].filter((comment) => precedes(comment, editor));
        const named = comments.findLast((comment) => startsWithName(text, authorOf(site, comment)));
        if (named) return named;
        // Facebook opens the reply box under the comment, inside its thread, labelled "Reply to Anna Smith".
        const label = labelOf(editor);
        if (!REPLY_LABEL.test(label)) return null;
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
         * @returns {{kind: 'post' | 'comment' | 'message', text: string} | null}
         */
        find(editor, text) {
            const site = SITES.find(({host}) => host.test(window.location.hostname));
            if (!site) return null;
            if (site.message) {
                const message = lastMessage(site);
                return message ? {kind: 'message', text: message} : null;
            }
            const comment = answeredComment(site, editor, text);
            if (comment) {
                const answered = commentText(site, comment);
                if (answered) return {kind: 'comment', text: answered};
            }
            const caption = postCaption(site, editor);
            return caption ? {kind: 'post', text: caption} : null;
        }
    });
})();
