// Telegram Web K (/k/) and A (/a/): chats (js/sites/sites.js).
SecretMessageSites.register({
    host: /^web\.telegram\.org$/i,
    topic: 'Web chat',
    message: '.bubble .message, .Message .text-content',
    meta: '.time, .MessageMeta, .reactions, .Reactions, .reply, .EmbeddedMessage'
});
