// Facebook: comments on posts (js/sites/sites.js).
SecretMessageSites.register({
    name: 'facebook',
    host: /(^|\.)facebook\.com$/i,
    topic: 'FB post',
    // Feed and group posts, and a post opened in a dialog.
    post: '[aria-posinset], [role="article"]:not([aria-label]), [role="dialog"]',
    caption: '[data-ad-rendering-role="story_message"], [data-ad-comet-preview="message"], [data-ad-preview="message"]',
    // Comments and replies are articles labelled "Comment by …" / "Reply by …".
    comment: '[role="article"][aria-label]',
    commentText: 'div[dir="auto"]',
    // The reply box opens under the comment, inside its thread: "Reply to Anna", "Write a reply…", "Ответить",
    // "Відповісти", "Antworten", "Répondre"…
    replyLabel: /reply|answer|respon|répon|antwort|rispon|ответ|відпов|odpowi/i
});
