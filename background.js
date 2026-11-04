const MENU_ITEM_ID = "openSecretMessageMenuItem";
const CONVERT_MENU_ITEM_ID = "convertMenuItem";
const AUTO_DECODING_MENU_ITEM_ID = "autoDecodingMenuItem";
// Read by js/hover-decoder.js; auto decoding is off until turned on from the menu or with the hot key.
const AUTO_DECODING_KEY = "autoDecoding";

// Pages with the hover decoder content script; keep in sync with content_scripts in manifest.json.
const MESSENGER_PAGES = [
    "https://*.facebook.com/*",
    "https://*.messenger.com/*",
    "https://vk.com/*",
    "https://*.vk.com/*",
    "https://vk.ru/*",
    "https://*.vk.ru/*",
    "https://web.telegram.org/*",
    "https://*.linkedin.com/*"
];

// Encode / decode, settings storage and the site-specific code (js/sites/); the Facebook / VK / Telegram / LinkedIn content scripts in
// manifest.json load them too.
const CORE_SCRIPTS = [
    "js/lib/secret-message-env.js",
    "js/lib/jszip.min.js",
    "js/lib/security-utils.js",
    "js/lib/secret-message.js",
    "js/lib/secret-message-settings.js",
    "js/sites/sites.js",
    "js/sites/facebook.js",
    "js/sites/vk.js",
    "js/sites/telegram.js",
    "js/sites/linkedin.js"
];

// The widget, injected on icon click / hot key / menu click (activeTab grants access to the current page).
const WIDGET_SCRIPTS = [
    "js/lib/client.min.js",
    "js/lib/detect.min.js",
    "js/lib/device-secret.js",
    "js/conversation-context.js",
    "js/secret-message-widget.js"
];

chrome.runtime.onInstalled.addListener(({reason}) => {
    // The welcome page with the promo video, once: not after updates or reloads.
    if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.tabs.create({url: chrome.runtime.getURL("docs/welcome.html")});
    }
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: MENU_ITEM_ID,
            title: chrome.i18n.getMessage("menuTitle"),
            contexts: ["all"],
            documentUrlPatterns: ["http://*/*", "https://*/*"]
        });
        chrome.contextMenus.create({
            id: CONVERT_MENU_ITEM_ID,
            title: chrome.i18n.getMessage("convertMenuTitle"),
            contexts: ["editable"],
            documentUrlPatterns: ["http://*/*", "https://*/*"]
        });
        chrome.contextMenus.create({
            id: AUTO_DECODING_MENU_ITEM_ID,
            title: chrome.i18n.getMessage("autoDecodingMenuTitle"),
            type: "checkbox",
            contexts: ["all"],
            documentUrlPatterns: MESSENGER_PAGES
        });
        // Sets the checkbox and the badge from the stored state.
        showAutoDecodingState();
    });
});

chrome.runtime.onStartup.addListener(() => showAutoDecodingState());

//-----------------------auto decoding on / off (shared by all tabs through chrome.storage.local)-----------------------

async function isAutoDecodingOn() {
    const stored = await chrome.storage.local.get(AUTO_DECODING_KEY);
    return stored[AUTO_DECODING_KEY] === true;
}

function setAutoDecoding(on) {
    return chrome.storage.local.set({[AUTO_DECODING_KEY]: on});
}

// The menu checkbox and an "ON" badge on the toolbar icon show the state, also after the hot key.
async function showAutoDecodingState() {
    const on = await isAutoDecodingOn();
    chrome.contextMenus.update(AUTO_DECODING_MENU_ITEM_ID, {checked: on}, () => void chrome.runtime.lastError);
    chrome.action.setBadgeText({text: on ? "ON" : ""});
    chrome.action.setBadgeBackgroundColor({color: "#7C4DFF"});
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && AUTO_DECODING_KEY in changes) {
        showAutoDecodingState();
    }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === "toggle-auto-decoding") {
        await setAutoDecoding(!(await isAutoDecodingOn()));
    } else if (command === "convert-focused-text") {
        convertFocusedText(tab);
    }
});

//-----------------------widget-----------------------------------------------------------------------------------------

// The help and privacy buttons of the widget.
const DOCS = {help: "docs/help.html", privacy: "docs/privacy.html"};

chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "openDoc" && Object.hasOwn(DOCS, message.page)) {
        chrome.tabs.create({url: chrome.runtime.getURL(DOCS[message.page])});
    }
});

// Chrome does not let extensions script its own pages (chrome://, the Web Store, the PDF viewer…), so a click there
// does nothing. Without access the tab URL is not even visible; only http(s) pages are tried, and Chrome's refusal on
// protected http(s) pages is expected, not an error.
const NO_ACCESS_ERROR = /cannot access|cannot be scripted/i;

// Runs func in the page once the widget is injected.
const inWidget = (func) => (tab) => {
    if (!/^https?:/.test(tab?.url ?? "")) {
        return;
    }
    callWidget(tab, func).catch((error) => {
        if (!NO_ACCESS_ERROR.test(error.message)) console.error(error);
    });
};

const openWidget = inWidget(() => SecretMessageWidget.show());
// The text in the focused text box becomes the private message and is replaced with the public phrase.
const convertFocusedText = inWidget(() => SecretMessageWidget.convertFocused());

chrome.action.onClicked.addListener(openWidget);

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_ITEM_ID) {
        openWidget(tab);
    } else if (info.menuItemId === CONVERT_MENU_ITEM_ID) {
        convertFocusedText(tab);
    } else if (info.menuItemId === AUTO_DECODING_MENU_ITEM_ID) {
        setAutoDecoding(info.checked);
    }
});

// A match pattern of MESSENGER_PAGES ("https://*.vk.com/*") as a regular expression.
const patternToRegExp = (pattern) => {
    const [, scheme, host, path] = pattern.match(/^(\w+):\/\/([^/]+)(\/.*)$/);
    const escape = (text) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    // "*.example.com" is example.com and its subdomains.
    const hostPattern = host.startsWith("*.") ? `([^/]+\\.)?${escape(host.slice(2))}` : escape(host);
    return new RegExp(`^${scheme}://${hostPattern}${escape(path).replace(/\*/g, ".*")}$`);
};
const MESSENGER_PAGE_PATTERNS = MESSENGER_PAGES.map(patternToRegExp);

// Which libraries the page has; with waitForLoad, once the page has loaded, so content scripts are there if they come.
async function loadedScripts(target, waitForLoad) {
    const [{result}] = await chrome.scripting.executeScript({
        target,
        args: [waitForLoad],
        func: async (wait) => {
            if (wait && document.readyState !== "complete") {
                await new Promise((resolve) => {
                    window.addEventListener("load", resolve, {once: true});
                    setTimeout(resolve, 5000);
                });
            }
            // Content scripts at document_idle run at the latest right after the load event.
            if (wait) await new Promise((resolve) => setTimeout(resolve, 100));
            return {core: Boolean(window.SecretMessageSettingsStore), widget: Boolean(window.SecretMessageWidget)};
        }
    });
    return result;
}

async function callWidget(tab, func) {
    const target = {tabId: tab.id};
    // The libraries declare top-level classes and constants, so they can be injected only once per page. The content
    // scripts of MESSENGER_PAGES bring the core when the page has loaded; injecting it before that would declare it
    // twice. Tabs opened before the extension was installed or reloaded never get the content scripts.
    let loaded = await loadedScripts(target, false);
    if (!loaded.core && MESSENGER_PAGE_PATTERNS.some((pattern) => pattern.test(tab.url))) {
        loaded = await loadedScripts(target, true);
    }
    if (!loaded.core) {
        await chrome.scripting.executeScript({target, files: CORE_SCRIPTS});
    }
    if (!loaded.widget) {
        await chrome.scripting.executeScript({target, files: WIDGET_SCRIPTS});
    }
    await chrome.scripting.executeScript({target, func});
}
