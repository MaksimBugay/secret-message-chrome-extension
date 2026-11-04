// Globals that file.sharing.min.js provides on https://secure.fileshare.ovh and that the local copies of
// secret-message.js (PushcaClient.clusterBaseUrl) and device-secret.js (stringToArrayBuffer) depend on.
var PushcaClient = {clusterBaseUrl: 'https://secure.fileshare.ovh'};

function stringToArrayBuffer(str) {
    return new TextEncoder().encode(str).buffer;
}
