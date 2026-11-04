# secret-message-chrome-extension
Secret message Chrome extension (Manifest V3) – an on-page widget for
[Secure FileShare Secret Message](https://secure.fileshare.ovh/secret-message.html).

## How it works
- **Extension icon / `Ctrl+Shift+Y`** (`MacCtrl+Shift+Y` on macOS) or the single **context menu** item injects
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
- **Decode on hover:** on Facebook, Messenger, VK and Telegram Web it is on from page load (manifest content
  script, no click needed) and uses the obfuscation settings saved with the widget's *Save* button. It is paused while
  the widget is shown (expanded or collapsed) and resumes when the widget is closed; it does not run on other sites.
  Hovering over a text for 0.4 s tries to decode it (at most one request per second). Emoji drawn as images are read
  as their `alt` text. A secret message is replaced in place with `🔓 <original text>` and highlighted; anything else
  is left untouched. Each text is checked once per credentials.
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
| `background.js` | Icon / hot key / menu handlers, one-time script injection |
| `js/secret-message-widget.js`, `css/secret-message-widget.css` | The widget (shadow DOM) |
| `js/hover-decoder.js` | Content script for Facebook / VK / Telegram: decodes the text under the mouse pointer with the saved settings and replaces it in place |
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
The hot key can be changed in `chrome://extensions/shortcuts`.

To package: `zip -r secret-message.zip manifest.json background.js js css images _locales LICENSE`
