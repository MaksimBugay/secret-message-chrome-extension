// Facebook: comments on posts (js/sites/sites.js).
SecretMessageSites.register({
    host: /(^|\.)facebook\.com$/i,
    topic: 'FB post',
    // A post opened in a dialog; posts in the feed and on their own page have no marked container.
    post: '[role="dialog"]',
    caption: '[data-ad-rendering-role="story_message"]',
    // Comments and replies are articles labelled "Comment by …" / "Reply by …".
    comment: '[role="article"][aria-label]',
    commentText: 'div[dir="auto"]',
    // The reply box opens under the comment, inside its thread: "Reply to Anna", "Write a reply…", "Ответить",
    // "Відповісти", "Antworten", "Répondre"…
    replyLabel: /reply|answer|respon|répon|antwort|rispon|ответ|відпов|odpowi/i
});
