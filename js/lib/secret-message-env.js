// Globals that file.sharing.min.js provides on https://secure.fileshare.ovh and that the local copies of
// secret-message.js (PushcaClient.clusterBaseUrl) and device-secret.js (stringToArrayBuffer) depend on.
var PushcaClient = {clusterBaseUrl: 'https://secure.fileshare.ovh'};

function stringToArrayBuffer(str) {
    return new TextEncoder().encode(str).buffer;
}

// Key of the obfuscation settings in SecretMessageSettingsStore: the Secret Message page path, as on the web site.
const SECRET_MESSAGE_SETTINGS_KEY = '/secret-message.html';
