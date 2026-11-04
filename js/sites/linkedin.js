// LinkedIn: comments on posts (js/sites/sites.js). Feed posts are list items; a comment's text has the same markup as
// the post's, hence the caption is the text outside comments. A reply box opens in the comment list, filled in with a
// mention of the commenter.
SecretMessageSites.register({
    host: /(^|\.)linkedin\.com$/i,
    topic: 'LinkedIn post',
    post: '[role="listitem"][componentkey^="update-card-focus"]',
    caption: '[id^="translatable-commentary"] [data-testid="expandable-text-box"]:not([componentkey^="replaceableComment_"] *)',
    comment: '[componentkey^="replaceableComment_"]',
    commentText: '[data-testid="expandable-text-box"]',
    // The name is the first line of the commenter's link; next to a badge ("Anna Smith • 2nd") it is the visible copy,
    // whose own text is the name, beside a screen reader copy ("Anna Smith, Open to work 2nd").
    authorName(comment) {
        const line = comment.querySelector('a p');
        if (!line) return '';
        const visible = line.querySelector('[aria-hidden="true"]');
        if (!visible) return line.textContent.trim();
        return [...visible.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.nodeValue).join('').trim();
    }
});
