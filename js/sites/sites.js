// What is specific to a web site, for the domain of the page: each js/sites/<site>.js registers its site, and the main
// code (js/conversation-context.js, the widget) asks SecretMessageSites.forHost for the one of the page. Pages of other
// sites get the generic site.
window.SecretMessageSites = (function () {
    'use strict';

    /**
     * @typedef {object} Site
     * @property {string} name
     * @property {RegExp} [host] Host names of the site; the generic site has none.
     * @property {string} topic Conversation topic set when the widget opens.
     * Comments on posts (Facebook, VK); selectors, several when the site has more than one markup:
     * @property {string} [post] A post, with its comments and the comment box.
     * @property {string} [caption] The text of a post.
     * @property {string} [comment] A comment or a reply.
     * @property {string} [commentText] The text of a comment.
     * @property {string} [author] The commenter's name in a comment; else the first link with text.
     * @property {RegExp} [replyLabel] Label of a reply box opened inside the thread of the answered comment.
     * Chats (Telegram Web):
     * @property {string} [message] A message of the open chat.
     * @property {string} [meta] What a message holds besides its text: time, reactions, quoted reply.
     */

    /** @type {Site} */
    const GENERIC = Object.freeze({name: 'generic', topic: 'Web chat'});
    /** @type {Site[]} */
    const sites = [];

    return Object.freeze({
        /** @param {Site} site */
        register(site) {
            sites.push(Object.freeze(site));
        },
        /**
         * @param {string} [hostname] Of the page by default.
         * @returns {Site}
         */
        forHost(hostname = window.location.hostname) {
            return sites.find(({host}) => host.test(hostname)) ?? GENERIC;
        }
    });
})();
