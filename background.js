const MENU_ITEM_ID = "openSecretMessageMenuItem";

// Encode / decode and settings storage; the Facebook / VK / Telegram content scripts in manifest.json load them too.
const CORE_SCRIPTS = [
    "js/lib/secret-message-env.js",
    "js/lib/jszip.min.js",
    "js/lib/security-utils.js",
    "js/lib/secret-message.js",
    "js/lib/secret-message-settings.js"
];

// The widget, injected on icon click / hot key / menu click (activeTab grants access to the current page).
const WIDGET_SCRIPTS = [
    "js/lib/client.min.js",
    "js/lib/detect.min.js",
    "js/lib/device-secret.js",
    "js/secret-message-widget.js"
];

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: MENU_ITEM_ID,
            title: chrome.i18n.getMessage("menuTitle"),
            contexts: ["all"],
            documentUrlPatterns: ["http://*/*", "https://*/*"]
        });
    });
});

const openWidget = (tab) => showWidget(tab).catch((error) => console.error(error));

chrome.action.onClicked.addListener(openWidget);

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_ITEM_ID) {
        openWidget(tab);
    }
});

async function showWidget(tab) {
    if (tab?.id === undefined) {
        return;
    }
    const target = {tabId: tab.id};
    // The libraries declare top-level classes and constants, so they can be injected only once per page.
    const [{result: loaded}] = await chrome.scripting.executeScript({
        target,
        func: () => ({core: Boolean(window.SecretMessageSettingsStore), widget: Boolean(window.SecretMessageWidget)})
    });
    if (!loaded.core) {
        await chrome.scripting.executeScript({target, files: CORE_SCRIPTS});
    }
    if (!loaded.widget) {
        await chrome.scripting.executeScript({target, files: WIDGET_SCRIPTS});
    }
    await chrome.scripting.executeScript({target, func: () => SecretMessageWidget.show()});
}
