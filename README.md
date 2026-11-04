# secret-message-chrome-extension
Secret message Chrome extension (Manifest V3) – an on-page widget for
[Secure FileShare Secret Message](https://secure.fileshare.ovh/secret-message.html).

## How it works
- **Extension icon / `Ctrl+Shift+Y`** (`MacCtrl+Shift+Y` on macOS) or the **Create a secret message** context menu item injects
  the Secret Message widget into the current page (no popup, nothing runs until you click).
- The widget is **movable** (drag the header) and **collapsible** to a small pill; position and state are remembered.
- Two icon tabs: **Derivation** (wand – the message to encode) and **Settings** (gear). Under the *Obfuscation
  settings* header (save / export / import) Settings has two sub-tabs: **Conversation details** (topic, style,
  language, message history) and **Encryption** (workspace, password, owner signature). The widget opens on
  Settings → Encryption while no password is set.
- **Encode:** select text on the page (a Facebook post, VK post or chat messages) and open the widget:
  - the selected text is added to the conversation history;
  - the topic is set to `FB post` (facebook.com), `VK post` (vk.com / vk.ru) or `Web chat` (any other site);
  - type the private message and press **Encode message** – the public phrase is copied to the clipboard.
    If the clipboard is not available, the phrase is shown in the widget instead.
- **Convert in place:** type the private message in any text box (a comment, a reply, a chat message) and press
  `Ctrl+Shift+E` (`MacCtrl+Shift+E`) or choose **Convert into secret message** in the text box's context menu:
  - the message history is cleared and starts with what the reply answers (cut to the history limit): the caption
    of the commented post or the answered comment (Facebook, VK; a reply starting with the commenter's name or, on
    Facebook, a box labelled "Reply to …"), or the last message of the open chat (Telegram Web);
  - the message is encoded with the widget's current obfuscation settings and history, without opening the widget;
    a small note above the text box shows the progress;
  - the text in the box is replaced with the public phrase (undo with `Ctrl+Z`). If the text was changed meanwhile,
    the phrase is copied to the clipboard instead;
  - without a workspace or password the widget opens on Settings → Encryption with the missing field focused.
- **Auto decoding** (Facebook, Messenger, VK, Telegram Web) is **off by default**. Turn it on or off with the
  context menu item *Auto-decode secret messages* or `Ctrl+Shift+L` (`MacCtrl+Shift+L`); the setting applies to all
  tabs and the toolbar icon shows an **ON** badge while it is on. It uses the obfuscation settings saved with the
  widget's *Save* button and is paused while the widget is shown (expanded or collapsed).
  Hovering over a text for 0.4 s tries to decode it (at most one request per second); emoji drawn as images are read
  as their `alt` text. The server matches phrases exactly, and sites often drop the invisible `U+FE0F` after emoji such
  as 🕷 ❤ ☀, so phrases with these emoji are also tried with and without it. The public phrase is left untouched and the private message is shown right after it, in italic
  violet, after a magic-eye icon. A text the server reports as not secret is checked only once per credentials;
  failed requests (offline, rate limit, server error) are retried on the next hover.
- Obfuscation settings (workspace, password, owner signature, topic/style/language) are saved per site
  (e.g. www.facebook.com, vk.com, web.telegram.org) in that site's IndexedDB, in the same encrypted format the
  Secret Message page uses. They survive reinstalling the extension and are removed when the site's data is cleared.
  Import/export as JSON.
- **Message history** is edited in a *Message history* dialog (Settings → Conversation details → Edit), like on the
  Secret Message page. It lives only in the open page: it is never saved in the browser and starts empty after a
  reload. Exported JSON files still include it.

## Files
| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest, `_execute_action` hot key, `activeTab`, content scripts for Facebook / VK / Telegram |
| `background.js` | Icon / hot key / menu handlers, one-time script injection, auto decoding on / off |
| `js/secret-message-widget.js`, `css/secret-message-widget.css` | The widget (shadow DOM) |
| `js/conversation-context.js` | What a reply answers (post caption, comment, last chat message) for *Convert into secret message*; site selectors for Facebook / VK / Telegram |
| `js/hover-decoder.js` | Content script for Facebook / VK / Telegram: auto decoding – shows the private message after the phrase under the mouse pointer |
| `js/lib/secret-message.js` | Encode / decode (copy of the site's script) |
| `js/lib/security-utils.js` | AES-GCM / PBKDF2 / SHA-256 helpers (copy of the site's script) |
| `js/lib/secret-message-settings.js` | Encrypted settings store in the page site's IndexedDB (copy of the site's script) |
| `js/lib/device-secret.js`, `client.min.js`, `detect.min.js` | Browser fingerprint for the owner signature (copies) |
| `js/lib/jszip.min.js` | JSZip 3.10.1 |
| `js/lib/secret-message-env.js` | Globals the site's bundle normally provides (`PushcaClient.clusterBaseUrl`, `stringToArrayBuffer`) and the settings key |
| `images/icon-*.png` | Icons; sources in `resources/icon-src/*.svg` |
| `_locales/*` | en, ru, uk, de, es, fr |

Apart from `secret-message-env.js`, the files in `js/lib/` are unmodified copies from `https://secure.fileshare.ovh/js/` – refresh them from there when
the site changes.

## Development
Open `chrome://extensions`, enable *Developer mode*, *Load unpacked* and select this folder.
All hot keys can be changed in `chrome://extensions/shortcuts`.

To package: `zip -r secret-message.zip manifest.json background.js js css images _locales LICENSE`
