// Movable, collapsible Secret Message widget injected on extension icon click.
// Mirrors https://secure.fileshare.ovh/secret-message.html using local copies of the site's scripts:
// secret-message.js (encode / decode), device-secret.js (owner signature) and secret-message-settings.js
// (encrypted settings storage in the IndexedDB of the page's site, so settings survive reinstalling the extension).
(function () {
    'use strict';

    const SETTINGS_PAGE = '/secret-message.html';
    const STATE_KEY = 'secretMessageWidgetState';
    const HISTORY_LIMIT = 1500;
    const EDGE_MARGIN = 12;
    // Below the top bars of Facebook / VK / Telegram and away from the chat box at the bottom.
    const DEFAULT_TOP = 72;

    const ICONS = {
        logo: '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="smwBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E3A8A"/><stop offset=".55" stop-color="#3473CE"/><stop offset="1" stop-color="#7C4DFF"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#smwBg)"/><path fill="#fff" d="M9 5h14a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-8l-6 5v-5.2A5 5 0 0 1 4 18v-8a5 5 0 0 1 5-5Z"/><path d="M13 13.5v-1.8a3 3 0 0 1 6 0v1.8" fill="none" stroke="#3B5BD6" stroke-width="2"/><rect x="11" y="13" width="10" height="7.5" rx="1.8" fill="#3B5BD6"/></svg>',
        collapse: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14l6-6 6 6"/></svg>',
        expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10l6 6 6-6"/></svg>',
        close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
        eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="smw-eye-slash" d="m3 3 18 18"/></svg>',
        fingerprint: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7a9 9 0 0 1 17 4v2M3 11v2a8 8 0 0 1-1 4"/><path d="M6 17a12 12 0 0 0 1-5v-1a5 5 0 0 1 10 0v2a19 19 0 0 1-1 6"/><path d="M9 21a16 16 0 0 0 2-8v-2a1 1 0 0 1 2 0v2a23 23 0 0 1-1 8"/></svg>',
        save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8"/></svg>',
        download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></svg>',
        upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/></svg>',
        trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/></svg>',
        // A wand turning the private message into a public phrase.
        derivation: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 11-11"/><path d="m13 7 4 4"/><path d="M18 2v3M16.5 3.5h3M21 8v2M20 9h2M9 3v2M8 4h2"/></svg>',
        gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
        copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>'
    };

    const TOPICS = ['FB post', 'VK post', 'Web chat', 'Everyday life', 'Work', 'Travel', 'Family', 'Friends', 'Technology', 'Food', 'Health',
        'Entertainment', 'Plans'];
    const STYLES = ['Casual', 'Friendly', 'Formal', 'Professional', 'Humorous', 'Romantic', 'Supportive', 'Direct',
        'Curious', 'Storytelling'];
    const LOCALES = [['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'],
        ['ru', 'Russian'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['ar', 'Arabic'], ['hi', 'Hindi']];

    const options = (values) => values.map((value) => `<option value="${value}">${value}</option>`).join('');

    const TEMPLATE = `
<div class="smw" role="dialog" aria-label="Secret Message">
  <header class="smw-header">
    <span class="smw-logo">${ICONS.logo}</span>
    <div class="smw-title"><strong>Secret Message</strong><span>Public phrase, private message</span></div>
    <div class="smw-header-actions">
      <button type="button" class="smw-icon-button" data-ref="toggleCollapse" title="Collapse">${ICONS.collapse}</button>
      <button type="button" class="smw-icon-button" data-ref="close" title="Close">${ICONS.close}</button>
    </div>
  </header>
  <form class="smw-body" data-ref="form" novalidate>
    <div class="smw-mode smw-icon-tabs" role="radiogroup" aria-label="View">
      <label title="Derivation – turn your private message into a public phrase"><input type="radio" name="tab" value="derivation" aria-label="Derivation" checked><span>${ICONS.derivation}</span></label>
      <label title="Settings"><input type="radio" name="tab" value="settings" aria-label="Settings"><span>${ICONS.gear}</span></label>
    </div>

    <section class="smw-settings" data-tab-panel="settings" hidden>
      <div class="smw-settings-heading">
        <h2>Obfuscation settings</h2>
        <div class="smw-settings-tools">
          <button type="button" class="smw-icon-button" data-ref="saveSettings" title="Save obfuscation settings in this browser">${ICONS.save}</button>
          <button type="button" class="smw-icon-button" data-ref="exportSettings" title="Save settings as a JSON file (includes password)">${ICONS.download}</button>
          <button type="button" class="smw-icon-button" data-ref="importSettings" title="Open settings from a JSON file">${ICONS.upload}</button>
          <input type="file" data-ref="settingsFile" accept=".json,application/json" hidden>
        </div>
      </div>
      <div class="smw-mode smw-subtabs" role="radiogroup" aria-label="Settings section">
        <label><input type="radio" name="settingsTab" value="conversation" checked><span>Conversation details</span></label>
        <label><input type="radio" name="settingsTab" value="encryption"><span>Encryption</span></label>
      </div>
      <div data-settings-panel="conversation">
        <label class="smw-label" for="smwTopic">Topic</label>
        <div class="smw-row">
          <input id="smwTopic" data-ref="topic" maxlength="500" placeholder="Choose or type a topic" autocomplete="off">
          <select class="smw-preset" data-ref="topicPreset" title="Choose topic from list"><option value="" selected disabled hidden>▾</option>${options(TOPICS)}</select>
        </div>
        <label class="smw-label" for="smwStyle">Style</label>
        <div class="smw-row">
          <input id="smwStyle" data-ref="style" maxlength="100" placeholder="Choose or type a style" autocomplete="off">
          <select class="smw-preset" data-ref="stylePreset" title="Choose style from list"><option value="" selected disabled hidden>▾</option>${options(STYLES)}</select>
        </div>
        <label class="smw-label" for="smwLocale">Language</label>
        <select id="smwLocale" data-ref="locale">${LOCALES.map(([code, name]) => `<option value="${code}">${name} (${code})</option>`).join('')}</select>
        <div class="smw-history-summary">
          <div><span>Message history</span><strong data-ref="historyCount">0 messages</strong></div>
          <button type="button" class="smw-secondary smw-small" data-ref="editHistory" aria-haspopup="dialog">Edit</button>
        </div>
        <label class="smw-check smw-check-block" title="Append generated public phrases to conversation history"><input data-ref="appendToHistory" type="checkbox" checked>Append generated phrases to history</label>
      </div>
      <div data-settings-panel="encryption" hidden>
        <label class="smw-label" for="smwWorkspace">Workspace</label>
        <div class="smw-row">
          <input id="smwWorkspace" data-ref="workspace" type="text" maxlength="100" autocomplete="off" placeholder="e.g. our-private-space">
          <button type="button" class="smw-secondary smw-small" data-ref="generateWorkspace" title="Generate a new workspace">Generate</button>
        </div>
        <label class="smw-label" for="smwPassword">Password</label>
        <div class="smw-row">
          <input id="smwPassword" data-ref="password" type="password" autocomplete="off" placeholder="••••••••">
          <button type="button" class="smw-icon-button smw-boxed" data-ref="togglePassword" title="Show password" aria-pressed="false">${ICONS.eye}</button>
        </div>
        <label class="smw-label" for="smwOwnerSignature">Owner signature <span class="smw-optional">Optional</span></label>
        <div class="smw-row">
          <input id="smwOwnerSignature" data-ref="ownerSignature" type="text" maxlength="200" autocomplete="off" placeholder="Your shared signature">
          <button type="button" class="smw-icon-button smw-boxed" data-ref="retrieveOwnerSignature" title="Use this browser’s fingerprint as the owner signature">${ICONS.fingerprint}</button>
        </div>
      </div>
      <p class="smw-panel-status" data-status role="status" aria-live="polite"></p>
    </section>

    <div class="smw-derivation" data-tab-panel="derivation">
      <div class="smw-card">
        <div class="smw-card-heading">
          <label for="smwMessageInput">Your private message</label>
        </div>
        <textarea id="smwMessageInput" data-ref="messageInput" rows="4" spellcheck="false" placeholder="Write something just for them…"></textarea>
        <div class="smw-card-footer">
          <span data-ref="inputCount">0 characters</span>
          <button type="button" class="smw-text-button" data-ref="clearInput">Clear</button>
        </div>
      </div>

      <div class="smw-run-row">
        <div class="smw-feedback">
          <span class="smw-badge" data-ref="securityBadge">◈ Encrypted in your browser</span>
          <p data-ref="status" data-status role="status" aria-live="polite" hidden></p>
        </div>
        <button type="submit" class="smw-primary" data-ref="runButton">Encode message →</button>
      </div>

      <div class="smw-card smw-result-card" data-ref="result" hidden>
        <div class="smw-card-heading">
          <span>Public phrase</span>
          <button type="button" class="smw-text-button" data-ref="copyResult">${ICONS.copy}Copy</button>
        </div>
        <p class="smw-result-text" data-ref="resultText"></p>
      </div>
    </div>
  </form>

  <dialog class="smw-dialog" data-ref="historyDialog" aria-labelledby="smwHistoryTitle">
    <div class="smw-dialog-heading">
      <div><p class="smw-eyebrow">CONVERSATION</p><h2 id="smwHistoryTitle">Message history</h2></div>
      <button type="button" class="smw-icon-button" data-ref="closeHistory" title="Close message history">${ICONS.close}</button>
    </div>
    <p class="smw-muted smw-dialog-note">Kept only until the page is reloaded; it is never saved in the browser.</p>
    <ol class="smw-history-list" data-ref="historyRows"></ol>
    <p class="smw-muted" data-ref="emptyHistory">No messages yet. Add your first note below.</p>
    <label class="smw-label" for="smwNewHistoryMessage">New message</label>
    <textarea id="smwNewHistoryMessage" data-ref="newHistoryMessage" rows="3" placeholder="Add a message to your history…"></textarea>
    <p class="smw-muted" data-ref="historyStatus" role="status" aria-live="polite"></p>
    <div class="smw-dialog-actions">
      <button type="button" class="smw-secondary smw-small" data-ref="clearHistory">Clear history</button>
      <button type="button" class="smw-secondary smw-small" data-ref="appendHistory">Append message</button>
      <button type="button" class="smw-primary smw-small" data-ref="doneHistory">Done</button>
    </div>
  </dialog>
</div>`;

    //-----------------------mount----------------------------------------------------------------------------------

    const host = document.createElement('secret-message-widget');
    host.style.cssText = 'all: initial; position: fixed; z-index: 2147483646; display: none;';
    const shadow = host.attachShadow({mode: 'closed'});
    shadow.innerHTML = TEMPLATE;
    loadStyles();
    document.documentElement.appendChild(host);

    const root = shadow.querySelector('.smw');
    const ui = {};
    shadow.querySelectorAll('[data-ref]').forEach((element) => { ui[element.dataset.ref] = element; });
    const form = ui.form;
    const header = shadow.querySelector('.smw-header');

    function loadStyles() {
        // Extension resources are not subject to the page CSP, unlike an inline <style>.
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('css/secret-message-widget.css');
        link.addEventListener('load', () => {
            if (host.style.display !== 'none') clampPosition();
        });
        shadow.prepend(link);
    }

    //-----------------------state: position, collapse, visibility--------------------------------------------------

    const state = {left: null, top: null, collapsed: false};

    function clampPosition() {
        // clientWidth / clientHeight exclude the page scrollbars.
        const rect = host.getBoundingClientRect();
        const viewport = document.documentElement;
        const maxLeft = Math.max(EDGE_MARGIN, viewport.clientWidth - rect.width - EDGE_MARGIN);
        const maxTop = Math.max(EDGE_MARGIN, viewport.clientHeight - rect.height - EDGE_MARGIN);
        if (state.left === null || state.top === null) {
            state.left = maxLeft;
            state.top = DEFAULT_TOP;
        }
        state.left = Math.min(Math.max(EDGE_MARGIN, state.left), maxLeft);
        state.top = Math.min(Math.max(EDGE_MARGIN, state.top), maxTop);
        host.style.left = `${state.left}px`;
        host.style.top = `${state.top}px`;
    }

    function saveState() {
        chrome.storage.local.set({[STATE_KEY]: state}).catch(() => undefined);
    }

    function setCollapsed(collapsed) {
        // Keep the right edge in place so the collapsed pill stays where the widget was docked.
        const before = host.getBoundingClientRect();
        state.collapsed = collapsed;
        root.classList.toggle('smw-collapsed', collapsed);
        ui.toggleCollapse.innerHTML = collapsed ? ICONS.expand : ICONS.collapse;
        ui.toggleCollapse.title = collapsed ? 'Expand' : 'Collapse';
        if (host.style.display !== 'none' && state.left !== null) {
            state.left += before.width - host.getBoundingClientRect().width;
        }
        clampPosition();
        saveState();
    }

    // Hover decoding (Facebook, VK, Telegram) is paused while the widget is shown, expanded or collapsed.
    function show() {
        host.style.display = 'block';
        clampPosition();
        SecretMessageHoverDecoder.setPaused(true);
    }

    function hide() {
        host.style.display = 'none';
        SecretMessageHoverDecoder.setPaused(false);
    }

    window.addEventListener('resize', () => {
        if (host.style.display !== 'none') clampPosition();
    });
    // Keep the widget on screen when it grows (settings view, conversation details).
    new ResizeObserver(() => {
        if (host.style.display !== 'none') clampPosition();
    }).observe(root);

    // Dragging by the header; a click without movement on the collapsed header expands the widget.
    let drag = null;
    header.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || event.target.closest('button')) return;
        drag = {x: event.clientX, y: event.clientY, left: state.left, top: state.top, moved: false};
        header.setPointerCapture(event.pointerId);
    });
    header.addEventListener('pointermove', (event) => {
        if (!drag) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 4) return;
        drag.moved = true;
        root.classList.add('smw-dragging');
        state.left = drag.left + dx;
        state.top = drag.top + dy;
        clampPosition();
    });
    header.addEventListener('pointerup', (event) => {
        if (!drag) return;
        header.releasePointerCapture(event.pointerId);
        root.classList.remove('smw-dragging');
        if (drag.moved) saveState();
        else if (state.collapsed) setCollapsed(false);
        drag = null;
    });
    header.addEventListener('pointercancel', () => {
        drag = null;
        root.classList.remove('smw-dragging');
    });

    ui.toggleCollapse.addEventListener('click', () => setCollapsed(!state.collapsed));
    ui.close.addEventListener('click', hide);

    // Keep page keyboard shortcuts (Facebook, VK, Telegram) from reacting to typing inside the widget.
    ['keydown', 'keyup', 'keypress'].forEach((type) => {
        root.addEventListener(type, (event) => event.stopPropagation());
    });

    //-----------------------helpers mirrored from secret-message-ui.js-----------------------------------------------

    const history = [];
    let busy = true;

    // Shown under the run button and at the bottom of the Settings and Conversation tabs.
    const status = (message, error = false) => {
        ui.securityBadge.hidden = Boolean(message);
        ui.status.hidden = !message;
        for (const element of shadow.querySelectorAll('[data-status]')) {
            element.textContent = message;
            element.dataset.error = String(error);
        }
    };

    function controls() {
        return [...form.querySelectorAll('input, button, textarea, select')];
    }

    async function withLockedControls(task) {
        busy = true;
        const all = controls();
        const disabled = all.map((control) => control.disabled);
        all.forEach((control) => { control.disabled = true; });
        form.setAttribute('aria-busy', 'true');
        try {
            return await task();
        } finally {
            busy = false;
            all.forEach((control, index) => { control.disabled = disabled[index]; });
            form.setAttribute('aria-busy', 'false');
        }
    }

    function readConversationDetails(details) {
        if (!details || typeof details !== 'object' || Array.isArray(details) ||
            typeof details.topic !== 'string' || typeof details.style !== 'string' || !Array.isArray(details.history)) {
            throw new Error('Choose a conversation JSON file containing topic, style and history.');
        }
        const normalized = normalizePublicConversationDetails(details);
        return {topic: details.topic, style: details.style, history: [...details.history], locale: normalized.locale};
    }

    function currentConversationDetails() {
        return readConversationDetails({topic: ui.topic.value, style: ui.style.value, history, locale: ui.locale.value});
    }

    function applyConversationDetails(details) {
        const validated = readConversationDetails(details);
        ui.topic.value = validated.topic;
        ui.style.value = validated.style;
        if (![...ui.locale.options].some((option) => option.value === validated.locale)) {
            const option = document.createElement('option');
            option.value = validated.locale;
            const name = new Intl.DisplayNames(['en'], {type: 'language'}).of(validated.locale);
            option.textContent = `${name} (${validated.locale})`;
            ui.locale.append(option);
        }
        ui.locale.value = validated.locale;
        history.splice(0, history.length, ...validated.history);
        renderHistory();
    }

    function readSettings(settings) {
        if (!settings || settings.version !== 1 || typeof settings.workspaceId !== 'string' ||
            !settings.workspaceId.trim() || settings.workspaceId.length > 100 ||
            typeof settings.password !== 'string' || typeof settings.ownerSignature !== 'string' ||
            settings.ownerSignature.length > 200 ||
            (settings.appendToHistory !== undefined && typeof settings.appendToHistory !== 'boolean')) {
            throw new Error('Choose a valid obfuscation settings JSON file.');
        }
        return {version: 1, workspaceId: settings.workspaceId, password: settings.password,
            ownerSignature: settings.ownerSignature, appendToHistory: settings.appendToHistory ?? true,
            publicConversationDetails: readConversationDetails(settings.publicConversationDetails)};
    }

    function currentSettings() {
        return readSettings({version: 1, workspaceId: ui.workspace.value, password: ui.password.value,
            ownerSignature: ui.ownerSignature.value, appendToHistory: ui.appendToHistory.checked,
            publicConversationDetails: currentConversationDetails()});
    }

    function applySettings(settings) {
        const validated = readSettings(settings);
        ui.workspace.value = validated.workspaceId;
        ui.password.value = validated.password;
        setPasswordVisible(false);
        ui.ownerSignature.value = validated.ownerSignature;
        ui.appendToHistory.checked = validated.appendToHistory;
        applyConversationDetails(validated.publicConversationDetails);
    }

    function generateWorkspace() {
        const previous = ui.workspace.value;
        let workspace;
        do {
            const bytes = crypto.getRandomValues(new Uint8Array(9));
            workspace = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
        } while (workspace === previous);
        ui.workspace.value = workspace;
    }

    function setPasswordVisible(visible) {
        ui.password.type = visible ? 'text' : 'password';
        ui.togglePassword.setAttribute('aria-pressed', String(visible));
        ui.togglePassword.title = visible ? 'Hide password' : 'Show password';
    }

    // Tabs: derivation (the message to encode) and settings.
    function setTab(name) {
        form.querySelector(`[name="tab"][value="${name}"]`).checked = true;
        shadow.querySelectorAll('[data-tab-panel]').forEach((panel) => { panel.hidden = panel.dataset.tabPanel !== name; });
        clampPosition();
    }

    // Settings sub-tabs: conversation details and encryption (workspace, password, owner signature).
    function setSettingsTab(name) {
        form.querySelector(`[name="settingsTab"][value="${name}"]`).checked = true;
        shadow.querySelectorAll('[data-settings-panel]').forEach((panel) => {
            panel.hidden = panel.dataset.settingsPanel !== name;
        });
        clampPosition();
    }

    function showPasswordSettings() {
        setTab('settings');
        setSettingsTab('encryption');
    }

    function countInput() {
        ui.inputCount.textContent = `${ui.messageInput.value.length.toLocaleString()} characters`;
    }

    function showResult(text) {
        ui.resultText.textContent = text;
        ui.result.hidden = !text;
        if (text) ui.result.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    }

    function appendMessageToHistory(message) {
        // A single oversized message cannot fit without changing its content.
        if (message.length > HISTORY_LIMIT) return null;
        let total = history.reduce((length, item) => length + item.length, 0) + message.length;
        let removed = 0;
        while (history.length && total > HISTORY_LIMIT) {
            total -= history.shift().length;
            removed++;
        }
        history.push(message);
        renderHistory();
        return removed;
    }

    function renderHistory() {
        ui.historyRows.replaceChildren();
        history.forEach((message, index) => {
            const row = document.createElement('li');
            const editor = document.createElement('textarea');
            editor.rows = 1;
            editor.value = message;
            editor.setAttribute('aria-label', `Message ${index + 1}`);
            editor.addEventListener('input', () => { history[index] = editor.value; });
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'smw-icon-button';
            remove.title = 'Remove message';
            remove.innerHTML = ICONS.trash;
            remove.addEventListener('click', () => {
                history.splice(index, 1);
                renderHistory();
                const next = ui.historyRows.querySelectorAll('textarea');
                (next[Math.min(index, next.length - 1)] || ui.newHistoryMessage).focus();
            });
            row.append(editor, remove);
            ui.historyRows.append(row);
        });
        ui.emptyHistory.hidden = history.length > 0;
        ui.clearHistory.disabled = history.length === 0;
        ui.historyCount.textContent = `${history.length} ${history.length === 1 ? 'message' : 'messages'}`;
    }

    // The text selected on the page is the conversation the public phrase should fit into.
    function addSelectionToHistory(selection) {
        if (!selection || history[history.length - 1] === selection) return '';
        const removed = appendMessageToHistory(selection);
        if (removed === null) return ` Selected text exceeds ${HISTORY_LIMIT} characters and was not added to history.`;
        let message = ' Selected text added to history.';
        if (removed) message += ` Removed ${removed} oldest ${removed === 1 ? 'message' : 'messages'}.`;
        return message;
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (_) {
            return false;
        }
    }

    //-----------------------event handlers---------------------------------------------------------------------------

    form.querySelectorAll('[name="tab"]').forEach((input) => input.addEventListener('change', () => {
        setTab(input.value);
        if (input.value === 'derivation') ui.messageInput.focus();
    }));
    form.querySelectorAll('[name="settingsTab"]').forEach((input) => input.addEventListener('change', () => {
        setSettingsTab(input.value);
    }));
    ui.messageInput.addEventListener('input', countInput);
    ui.clearInput.addEventListener('click', () => {
        ui.messageInput.value = '';
        countInput();
        ui.messageInput.focus();
    });
    for (const [input, picker] of [[ui.topic, ui.topicPreset], [ui.style, ui.stylePreset]]) {
        picker.addEventListener('change', () => {
            if (!picker.value) return;
            input.value = picker.value;
            picker.value = '';
        });
    }
    ui.locale.addEventListener('change', () => { if (!ui.locale.value) ui.locale.value = 'en'; });

    ui.generateWorkspace.addEventListener('click', () => {
        generateWorkspace();
        ui.workspace.focus();
        ui.workspace.select();
        status('New workspace generated.');
    });
    ui.togglePassword.addEventListener('click', () => setPasswordVisible(ui.password.type === 'password'));

    ui.retrieveOwnerSignature.addEventListener('click', () => {
        if (busy) return;
        status('Retrieving owner signature…');
        withLockedControls(async () => {
            try {
                const signature = await getDeviceSecret();
                if (typeof signature !== 'string' || !signature) {
                    status('Unable to retrieve this browser’s fingerprint.', true);
                    return;
                }
                ui.ownerSignature.value = signature;
                status('Owner signature retrieved for this browser.');
            } catch (error) {
                status(error.message || 'Unable to retrieve this browser’s fingerprint.', true);
            }
        });
    });

    ui.saveSettings.addEventListener('click', async () => {
        ui.saveSettings.disabled = true;
        try {
            // Message history is conversation content: it lives only in this page and is never saved.
            const settings = currentSettings();
            settings.publicConversationDetails.history = [];
            await SecretMessageSettingsStore.save(SETTINGS_PAGE, settings);
            status(`Obfuscation settings saved securely for ${window.location.hostname}.`);
        } catch (error) {
            status(error.message || 'Unable to save obfuscation settings in this browser.', true);
        } finally {
            ui.saveSettings.disabled = busy;
        }
    });

    ui.exportSettings.addEventListener('click', () => {
        try {
            const json = JSON.stringify(currentSettings(), null, 2);
            const url = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'obfuscation-settings.json';
            shadow.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            status('Obfuscation settings JSON file saved.');
        } catch (error) {
            status(error.message || 'Unable to save the JSON file.', true);
        }
    });
    ui.importSettings.addEventListener('click', () => ui.settingsFile.click());
    ui.settingsFile.addEventListener('change', async () => {
        const file = ui.settingsFile.files[0];
        if (!file) return;
        if (file.size > 64 * 1024) {
            status('Choose a settings JSON file smaller than 64 KiB.', true);
            ui.settingsFile.value = '';
            return;
        }
        try {
            const data = JSON.parse(await file.text());
            if (data && Object.hasOwn(data, 'workspaceId')) applySettings(data);
            else applyConversationDetails(data); // Support conversation-only files.
            status('Obfuscation settings loaded. Select Save to remember them in this browser.');
        } catch (error) {
            status(error instanceof SyntaxError ? 'The selected file is not valid JSON.' : error.message, true);
        } finally {
            ui.settingsFile.value = '';
        }
    });

    ui.editHistory.addEventListener('click', () => {
        renderHistory();
        ui.historyStatus.textContent = '';
        ui.historyDialog.showModal();
        ui.newHistoryMessage.focus();
    });
    [ui.closeHistory, ui.doneHistory].forEach((button) => button.addEventListener('click', () => ui.historyDialog.close()));
    ui.appendHistory.addEventListener('click', () => {
        const message = ui.newHistoryMessage.value;
        if (!message.trim()) {
            ui.historyStatus.textContent = 'Write a message before appending.';
            ui.newHistoryMessage.focus();
            return;
        }
        const removed = appendMessageToHistory(message);
        if (removed === null) {
            ui.historyStatus.textContent = `A single history message must be at most ${HISTORY_LIMIT} characters.`;
            ui.newHistoryMessage.focus();
            return;
        }
        ui.newHistoryMessage.value = '';
        ui.historyStatus.textContent = removed
            ? `Message added. Removed ${removed} oldest ${removed === 1 ? 'message' : 'messages'}.`
            : 'Message added.';
        ui.newHistoryMessage.focus();
    });
    ui.clearHistory.addEventListener('click', () => {
        history.length = 0;
        renderHistory();
        ui.historyStatus.textContent = 'History cleared.';
        ui.newHistoryMessage.focus();
    });

    ui.copyResult.addEventListener('click', async () => {
        if (await copyToClipboard(ui.resultText.textContent)) status('Copied to the clipboard.');
        else status('Select and copy the text using your browser.', true);
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy) return;
        if (!ui.messageInput.value.trim()) {
            status('Enter a message first.', true);
            ui.messageInput.focus();
            return;
        }
        if (!ui.workspace.value.trim() || !ui.password.value) {
            showPasswordSettings();
            status('Enter a workspace and password in the settings first.', true);
            (ui.workspace.value.trim() ? ui.password : ui.workspace).focus();
            return;
        }
        const input = ui.messageInput.value;
        showResult('');
        ui.runButton.textContent = 'Encoding…';
        status('Encrypting and saving your message…');
        await withLockedControls(async () => {
            try {
                const args = [input, ui.password.value, ui.workspace.value, ui.ownerSignature.value || null];
                const phrase = await textToSecreteMessagePublicPhrase(...args, {
                    topic: ui.topic.value, style: ui.style.value,
                    history: history.filter((message) => message.trim()), locale: ui.locale.value
                });
                let message;
                if (await copyToClipboard(phrase)) {
                    message = 'Public phrase copied to the clipboard – paste it into the chat.';
                } else {
                    // Without clipboard access the phrase is shown so it can be copied by hand.
                    showResult(phrase);
                    message = 'Clipboard is not available – copy the public phrase below.';
                }
                if (ui.appendToHistory.checked) {
                    const removed = appendMessageToHistory(phrase);
                    if (removed === null) {
                        message += ` Not appended: this phrase alone exceeds ${HISTORY_LIMIT} characters.`;
                    } else {
                        message += ' Public phrase appended to history.';
                        if (removed) message += ` Removed ${removed} oldest ${removed === 1 ? 'message' : 'messages'}.`;
                    }
                }
                status(message);
            } catch (error) {
                status(error.message || 'Unable to process the message. Please try again.', true);
            } finally {
                ui.runButton.textContent = 'Encode message →';
            }
        });
    });

    //-----------------------startup----------------------------------------------------------------------------------

    countInput();
    renderHistory();

    SecretMessageHoverDecoder.configure({
        credentials: () => (busy ? null : {
            workspace: ui.workspace.value, password: ui.password.value, ownerSignature: ui.ownerSignature.value
        })
    });

    const ready = (async () => {
        const stored = await chrome.storage.local.get(STATE_KEY).catch(() => ({}));
        Object.assign(state, stored[STATE_KEY] || {});
        root.classList.toggle('smw-collapsed', state.collapsed);
        ui.toggleCollapse.innerHTML = state.collapsed ? ICONS.expand : ICONS.collapse;

        // Lock controls until restoration completes so a late read cannot overwrite user edits.
        await withLockedControls(async () => {
            try {
                const saved = await SecretMessageSettingsStore.load(SETTINGS_PAGE);
                // Ignore history kept by earlier versions; every page load starts with an empty history.
                if (saved !== null) {
                    applySettings({...saved, publicConversationDetails: {...saved.publicConversationDetails, history: []}});
                }
            } catch (_) {
                status('Saved settings could not be loaded. You can open a settings JSON file instead.', true);
            }
        });
        if (!ui.workspace.value) generateWorkspace();
        if (!ui.password.value) showPasswordSettings();
    })();

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action !== 'show-widget') return;
        ready.then(() => {
            const selection = SecretMessagePageContext.selection();
            show();
            if (state.collapsed) setCollapsed(false);
            ui.topic.value = SecretMessagePageContext.topic();
            status(`Topic set to “${ui.topic.value}”.${addSelectionToHistory(selection)}`);
            // Without a password nothing can be encoded, so open on the Settings tab.
            if (ui.password.value) setTab('derivation');
            else showPasswordSettings();
            (ui.password.value ? ui.messageInput : ui.password).focus();
        });
    });
})();
