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
- **Encode:** select text on the page (a Facebook, VK or LinkedIn post, or chat messages) and open the widget:
  - the selected text is added to the conversation history, without private messages shown by auto decoding;
  - the topic is set to `FB post` (facebook.com), `VK post` (vk.com / vk.ru), `LinkedIn post` (linkedin.com) or `Web chat`
    (any other site);
  - type the private message and press **Encode message** – the public phrase is copied to the clipboard.
    If the clipboard is not available, the phrase is shown in the widget instead.
- **Convert in place:** type the private message in any text box (a comment, a reply, a chat message) and press
  `Ctrl+Shift+E` (`MacCtrl+Shift+E`) or choose **Convert into secret message** in the text box's context menu:
  - the message history is cleared and starts with what the reply answers (cut to the history limit): the caption
    of the commented post, followed by the answered comment when replying to one (Facebook, VK, LinkedIn; a reply
    starting with the commenter's name or, on Facebook, a box labelled "Reply to …"; the caption's tail is cut so the
    comment fits), or the last message of the open chat (Telegram Web);
  - the message is encoded with the widget's current obfuscation settings and history, without opening the widget;
    a small note above the text box shows the progress;
  - a reply starting with the answered commenter's name (VK's `Anna, `, a Facebook or LinkedIn mention) keeps it: only the text
    after the name is encrypted and replaced, so the name (and a mention) stays in front of the public phrase;
  - the text in the box is replaced with the public phrase (undo with `Ctrl+Z`). If the text was changed meanwhile,
    the phrase is copied to the clipboard instead;
  - without a workspace or password the widget opens on Settings → Encryption with the missing field focused.
- **Auto decoding** (Facebook, Messenger, VK, Telegram Web, LinkedIn) is **off by default**. Turn it on or off with the
  context menu item *Auto-decode secret messages* or `Ctrl+Shift+L` (`MacCtrl+Shift+L`); the setting applies to all
  tabs and the toolbar icon shows an **ON** badge while it is on. It uses the obfuscation settings saved with the
  widget's *Save* button and is paused while the widget is shown (expanded or collapsed).
  Hovering over a text for 0.4 s tries to decode it (at most one request per second); emoji drawn as images are read
  as their `alt` text. The server matches phrases exactly, and sites often drop the invisible `U+FE0F` after emoji such
  as 🕷 ❤ ☀, so phrases with these emoji are also tried with and without it. A reply starting with a link (a VK, Facebook or LinkedIn mention of the answered
  person) is tried without that name first (*Convert into secret message* keeps it out of the phrase), then as it is. The public phrase is left untouched and the private message is shown right after it, in italic
  violet, after a magic-eye icon. A text the server reports as not secret is checked only once per credentials;
  failed requests (offline, server error) are retried on the next hover.
- **Private messages expire in 30 days:** the encrypted message is then removed from the server without any trace, so
  only the public phrase remains available (as an ordinary text that no longer decodes).
- **Daily limits** of the server, per IP address: 20 encoded messages (the widget and *Convert* then say so) and 1000
  decoding lookups (on HTTP 429 a notice appears in the page and auto decoding pauses for an hour). For higher limits,
  for example 1000 encodings per day and unlimited decoding, contact us at sfile4share@gmail.com.
- Obfuscation settings (workspace, password, owner signature, topic/style/language) are saved per site
  (e.g. www.facebook.com, vk.com, web.telegram.org) in that site's IndexedDB, in the same encrypted format the
  Secret Message page uses. They survive reinstalling the extension and are removed when the site's data is cleared.
  Changes to the workspace, password or owner signature are saved automatically a moment later (never an empty
  workspace or password); topic, style and language alone only with *Save*. Import/export as JSON.
- **Message history** is edited in a *Message history* dialog (Settings → Conversation details → Edit), like on the
  Secret Message page. It lives only in the open page: it is never saved in the browser and starts empty after a
  reload. Exported JSON files still include it.

## Files
| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest, `_execute_action` hot key, `activeTab`, content scripts for Facebook / VK / Telegram / LinkedIn |
| `background.js` | Icon / hot key / menu handlers, one-time script injection, auto decoding on / off |
| `js/secret-message-widget.js`, `css/secret-message-widget.css` | The widget (shadow DOM) |
| `js/conversation-context.js` | What a reply answers (post caption, comment, last chat message) for *Convert into secret message* |
| `js/sites/sites.js` | Site registry: `SecretMessageSites.forPage()` returns the site of the page's domain (or a generic one) |
| `js/sites/facebook.js`, `vk.js`, `telegram.js`, `linkedin.js` | Site-specific selectors and settings (topic, posts / comments / chat messages, reply box labels); add a site by registering it in a new file and listing it in `manifest.json` and `background.js` |
| `js/hover-decoder.js` | Content script for Facebook / VK / Telegram / LinkedIn: auto decoding – shows the private message after the phrase under the mouse pointer |
| `js/lib/secret-message.js` | Encode / decode (copy of the site's script) |
| `js/lib/security-utils.js` | AES-GCM / PBKDF2 / SHA-256 helpers (copy of the site's script) |
| `js/lib/secret-message-settings.js` | Encrypted settings store in the page site's IndexedDB (copy of the site's script) |
| `js/lib/device-secret.js`, `client.min.js`, `detect.min.js` | Browser fingerprint for the owner signature (copies) |
| `js/lib/jszip.min.js` | JSZip 3.10.1 |
| `js/lib/secret-message-env.js` | Globals the site's bundle normally provides (`PushcaClient.clusterBaseUrl`, `stringToArrayBuffer`) and the settings key |
| `docs/welcome.html`, `docs/promo.mp4` | Welcome page with the promo video, opened once after installing (not after updates) |
| `docs/help.html` | Documentation, opened from the widget's **?** button; the shield button opens the privacy policy at https://secure.fileshare.ovh/privacy/secret-message-privacy.html |
| `resources/video/` | Promo video `secret-message-promo.mp4`; sources in `source/` (`node render.mjs`) |
| `resources/store/` | Chrome Web Store images: screenshots (1280×800), small and marquee promo tiles (440×280, 1400×560), store icon (128×128): `node resources/video/source/render.mjs --store` |
| `images/icon-*.png` | Icons; sources in `resources/icon-src/*.svg` |
| `_locales/*` | en, ru, uk, de, es, fr |

Apart from `secret-message-env.js`, the files in `js/lib/` are unmodified copies from `https://secure.fileshare.ovh/js/` – refresh them from there when
the site changes.

## Development
Open `chrome://extensions`, enable *Developer mode*, *Load unpacked* and select this folder.
All hot keys can be changed in `chrome://extensions/shortcuts`.
The welcome page opens only on a fresh install: remove the extension and load it again to see it.

To package: `zip -r secret-message.zip manifest.json background.js js css images docs _locales LICENSE -x '*.DS_Store'`
