// What the widget needs from the page it is opened on: the selected text and the kind of conversation.
window.SecretMessagePageContext = (function () {
    function selection() {
        const current = window.getSelection();
        return current ? current.toString().trim() : '';
    }

    function topic() {
        const host = window.location.hostname;
        if (/(^|\.)facebook\.com$/i.test(host)) return 'FB post';
        if (/(^|\.)vk\.(com|ru)$/i.test(host)) return 'VK post';
        return 'Web chat';
    }

    return Object.freeze({selection, topic});
})();
