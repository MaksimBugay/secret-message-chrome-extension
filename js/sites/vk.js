// VK: comments on posts (js/sites/sites.js). The redesigned site marks elements with test ids and shows the comments in
// the post popup; the classes are those of the old site. A reply box opens inside the thread, filled in with "Anna, ".
SecretMessageSites.register({
    name: 'vk',
    host: /(^|\.)vk\.(com|ru)$/i,
    topic: 'VK post',
    post: '[data-testid="post"], .post, ._post',
    caption: '[data-testid="post_text"] [data-testid="showmoretext"], .wall_post_text',
    comment: '[data-testid="wall_comments_comment_root"], [data-testid="wall_comments_comment_in_thread"], .reply',
    commentText: '[data-testid="comment-text"], .wall_reply_text, .reply_text',
    author: '[data-testid="comment-owner"], .author'
});
