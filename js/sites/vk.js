// VK: comments on posts (js/sites/sites.js). Elements are marked with test ids; the comments of a feed post are in the
// post popup, those of a wall post under it. A reply box opens inside the thread, filled in with "Anna, ".
SecretMessageSites.register({
    host: /(^|\.)vk\.(com|ru)$/i,
    topic: 'VK post',
    post: '[data-testid="post"]',
    caption: '[data-testid="post_text"] [data-testid="showmoretext"]',
    comment: '[data-testid="wall_comments_comment_root"], [data-testid="wall_comments_comment_in_thread"]',
    commentText: '[data-testid="comment-text"]',
    author: '[data-testid="comment-owner"]'
});
