// Declared in the manifest for Facebook / Messenger / VK / Telegram Web: decodes secret messages under the mouse
// from page load with the obfuscation settings saved for this site. Once the widget is opened on the page,
// it supplies the credentials from its own fields instead.
(function () {
    const SETTINGS_PAGE = '/secret-message.html';
    let saved = null;

    async function loadSettings() {
        try {
            saved = await SecretMessageSettingsStore.load(SETTINGS_PAGE);
        } catch (_) {
            saved = null;
        }
    }

    SecretMessageHoverDecoder.configure({
        credentials: () => saved && {
            workspace: saved.workspaceId, password: saved.password, ownerSignature: saved.ownerSignature
        }
    });
    SecretMessageHoverDecoder.start();
    loadSettings();
    // Settings may have been saved in another tab in the meantime.
    window.addEventListener('focus', loadSettings);
})();
