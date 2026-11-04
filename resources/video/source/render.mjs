// Renders promo.html into ../secret-message-promo.mp4 with headless Chrome: each frame is drawn with render(t) and
// captured, then encoded with ffmpeg when it is installed, else with Chrome's own MediaRecorder (H.264 MP4).
//   node render.mjs                     the video
//   node render.mjs --preview 6.6,26    single frames, as preview-<t>.png in the frames folder
import {spawn, spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FPS = 30;
const WIDTH = 1280;
const HEIGHT = 720;
const PORT = 9335;
const here = dirname(fileURLToPath(import.meta.url));
const output = join(here, '..', 'secret-message-promo.mp4');
const framesDir = join(here, 'frames');
const previewArg = process.argv.indexOf('--preview');
const previews = previewArg > -1 ? process.argv[previewArg + 1].split(',').map(Number) : null;

// promo.html with the extension's logo, read from the widget so it stays the same.
const widget = readFileSync(join(here, '..', '..', '..', 'js', 'secret-message-widget.js'), 'utf8');
const logo = widget.match(/logo: '(<svg.*?<\/svg>)'/)[1];
const page = join(here, 'frames', 'promo.html');
mkdirSync(framesDir, {recursive: true});
writeFileSync(page, readFileSync(join(here, 'promo.html'), 'utf8').replace('%LOGO%', logo));

const profile = mkdtempSync(join(tmpdir(), 'promo-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars',
    '--disable-background-timer-throttling', '--force-device-scale-factor=1', `--window-size=${WIDTH},${HEIGHT}`, 'about:blank'], {stdio: 'ignore'});

async function connect() {
    for (let attempt = 0; ; attempt++) {
        try {
            const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            const tab = tabs.find((t) => t.type === 'page');
            const ws = new WebSocket(tab.webSocketDebuggerUrl);
            await new Promise((resolve) => ws.addEventListener('open', resolve));
            return ws;
        } catch (error) {
            if (attempt > 50) throw error;
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }
}

const ws = await connect();
let id = 0;
const pending = new Map();
ws.addEventListener('message', (message) => {
    const data = JSON.parse(message.data);
    if (pending.has(data.id)) {
        pending.get(data.id)(data);
        pending.delete(data.id);
    }
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, (data) => (data.error ? reject(new Error(`${method}: ${data.error.message}`)) : resolve(data.result)));
    ws.send(JSON.stringify({id, method, params}));
});
async function evaluate(expression) {
    const result = await call('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 500));
    return result.result.value;
}

try {
    await call('Emulation.setDeviceMetricsOverride', {width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false});
    await call('Page.navigate', {url: `file://${page}`});
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await evaluate('document.fonts.ready.then(() => true)');
    const duration = await evaluate('window.DURATION');

    const capture = async (t, format) => {
        await evaluate(`render(${t})`);
        return (await call('Page.captureScreenshot', {format, quality: format === 'jpeg' ? 92 : undefined})).data;
    };

    if (previews) {
        for (const t of previews) writeFileSync(join(framesDir, `preview-${t}.png`), Buffer.from(await capture(t, 'png'), 'base64'));
        console.log('previews in', framesDir);
    } else {
        const count = Math.round(duration * FPS);
        const frames = [];
        for (let frame = 0; frame < count; frame++) {
            frames.push(await capture(frame / FPS, 'jpeg'));
            if (frame % 150 === 0) console.log(`frame ${frame}/${count}`);
        }
        const ffmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
        if (ffmpeg) {
            frames.forEach((data, index) => writeFileSync(join(framesDir, `${String(index).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64')));
            const result = spawnSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', join(framesDir, '%05d.jpg'), '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p', '-c:v', 'libx264',
                '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', output], {stdio: 'inherit'});
            if (result.status !== 0) throw new Error('ffmpeg failed');
            rmSync(framesDir, {recursive: true, force: true});
        } else {
            await encodeInChrome(frames);
        }
        console.log('video:', output);
    }
} finally {
    ws.close();
    const exited = new Promise((resolve) => chrome.once('exit', resolve));
    chrome.kill();
    await exited;
    rmSync(profile, {recursive: true, force: true, maxRetries: 5});
}

// Plays the frames on a canvas at FPS and records it; the recording is real time, so this takes as long as the video.
async function encodeInChrome(frames) {
    await call('Page.navigate', {url: 'about:blank'});
    await new Promise((resolve) => setTimeout(resolve, 500));
    await evaluate('window.frames_ = []; true');
    for (let index = 0; index < frames.length; index += 25) {
        await evaluate(`window.frames_.push(...${JSON.stringify(frames.slice(index, index + 25))}); true`);
    }
    console.log('encoding in Chrome (real time)…');
    const size = await evaluate(`(async () => {
        const canvas = Object.assign(document.createElement('canvas'), {width: ${WIDTH}, height: ${HEIGHT}});
        const context = canvas.getContext('2d');
        const decode = async (data) => createImageBitmap(await (await fetch('data:image/jpeg;base64,' + data)).blob());
        context.drawImage(await decode(frames_[0]), 0, 0);
        const stream = canvas.captureStream(0);
        const track = stream.getVideoTracks()[0];
        const recorder = new MediaRecorder(stream, {mimeType: 'video/mp4;codecs=avc1.640028', videoBitsPerSecond: 8000000});
        const chunks = [];
        recorder.ondataavailable = (event) => chunks.push(event.data);
        const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
        recorder.start();
        const start = performance.now();
        let next = await decode(frames_[0]);
        for (let index = 0; index < frames_.length; index++) {
            const wait = start + index * ${1000 / FPS} - performance.now();
            if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
            context.drawImage(next, 0, 0);
            track.requestFrame();
            next.close();
            if (index + 1 < frames_.length) next = await decode(frames_[index + 1]);
        }
        await new Promise((resolve) => setTimeout(resolve, ${1000 / FPS}));
        recorder.stop();
        await stopped;
        window.video_ = new Uint8Array(await new Blob(chunks).arrayBuffer());
        return video_.length;
    })()`);
    const parts = [];
    for (let offset = 0; offset < size; offset += 4 * 1024 * 1024) {
        parts.push(Buffer.from(await evaluate(`(() => { let s = ''; const part = video_.subarray(${offset}, ${offset + 4 * 1024 * 1024});
            for (let i = 0; i < part.length; i += 32768) s += String.fromCharCode(...part.subarray(i, i + 32768)); return btoa(s); })()`), 'base64'));
    }
    writeFileSync(output, Buffer.concat(parts));
}
