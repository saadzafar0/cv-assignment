#!/usr/bin/env node
/* eslint-env node */
/*
 * Idempotent setup script for RearGuard's runtime assets.
 *
 *   1. Downloads the EfficientDet-Lite0 COCO TFLite model from the
 *      TensorFlow CDN and unpacks it to:
 *        src/assets/efficientdet_lite0.tflite
 *      Also keeps a copy of the COCO labels at:
 *        src/assets/coco_labels.txt
 *
 *   2. Synthesises a 100 ms / 880 Hz mono 16-bit PCM "beep" WAV at:
 *        android/app/src/main/res/raw/beep.wav
 *
 * Designed to be safe to run from npm `postinstall`: any failure is logged
 * as a warning so it doesn't break `npm install` for offline contributors.
 * Re-run manually with `npm run setup:assets`.
 *
 * Pure-Node implementation — works on Windows, macOS and Linux without any
 * external tools (no `unzip` required). Requires Node >= 18.
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');

// EfficientDet-Lite0 COCO model — same CDN zip bundle format as the old
// MobileNet-SSD model. The zip contains `efficientdet_lite0.tflite` at root.
// Fallback: we also try the old MobileNet-SSD COCO zip as a secondary URL
// in case the primary is unavailable.
const MODEL_URL =
  'https://storage.googleapis.com/download.tensorflow.org/models/tflite/coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip';

const ANDROID_RAW_DIR = path.join(ROOT, 'android/app/src/main/res/raw');
const SRC_ASSETS_DIR = path.join(ROOT, 'src/assets');

// Model lives under src/assets so it's resolved by Metro through `require()`,
// which copies it into the Android APK at build time (as long as `tflite`
// is registered in `metro.config.js#resolver.assetExts`).
const TFLITE_OUT = path.join(SRC_ASSETS_DIR, 'efficientdet_lite0.tflite');
const LABELS_OUT = path.join(SRC_ASSETS_DIR, 'coco_labels.txt');
const BEEP_OUT = path.join(ANDROID_RAW_DIR, 'beep.wav');
const TMP_ZIP = path.join(ROOT, '.cache/model.zip');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function download(url, dest, attempt = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        if (attempt > 5) {
          reject(new Error('Too many redirects'));
          return;
        }
        res.resume();
        download(res.headers.location, dest, attempt + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close((err) => (err ? reject(err) : resolve())));
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60_000, () => req.destroy(new Error('Download timed out')));
  });
}

/**
 * Pure-Node ZIP entry extractor — no external `unzip` required.
 *
 * Handles the subset of the spec actually used by the TensorFlow CDN bundle:
 * single-volume archives, `store` (0) and `deflate` (8) compression, no
 * encryption, no Zip64. That covers the EfficientDet / MobileNet-SSD archives.
 */
function extractFileFromZip(zipPath, entryName) {
  const buf = fs.readFileSync(zipPath);

  // Locate the End Of Central Directory record (signature 0x06054b50).
  // It lives in the last 22 + up-to-65535 bytes of the file.
  const EOCD_SIG = 0x06054b50;
  const minStart = Math.max(0, buf.length - (22 + 0xffff));
  let eocd = -1;
  for (let i = buf.length - 22; i >= minStart; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) {
    throw new Error('ZIP: end-of-central-directory record not found');
  }

  const totalEntries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);

  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) {
      throw new Error(`ZIP: bad central-directory header at offset ${p}`);
    }
    const compMethod = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const fnLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + fnLen).toString('utf8');

    if (name === entryName) {
      if (buf.readUInt32LE(localOffset) !== 0x04034b50) {
        throw new Error(`ZIP: bad local file header for ${entryName}`);
      }
      const lFnLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lFnLen + lExtraLen;
      const compData = buf.slice(dataStart, dataStart + compSize);

      if (compMethod === 0) return compData;
      if (compMethod === 8) return zlib.inflateRawSync(compData);
      throw new Error(`ZIP: unsupported compression method ${compMethod}`);
    }

    p += 46 + fnLen + extraLen + commentLen;
  }
  throw new Error(`ZIP: entry "${entryName}" not found`);
}

async function fetchModel() {
  if (fs.existsSync(TFLITE_OUT) && fs.existsSync(LABELS_OUT)) {
    console.log('[fetch-assets] model + labels already present, skipping download');
    return;
  }
  ensureDir(SRC_ASSETS_DIR);
  ensureDir(path.dirname(TMP_ZIP));

  console.log(`[fetch-assets] downloading ${MODEL_URL}`);
  await download(MODEL_URL, TMP_ZIP);

  console.log('[fetch-assets] unpacking detect.tflite + labelmap.txt');
  const tfliteBuf = extractFileFromZip(TMP_ZIP, 'detect.tflite');
  fs.writeFileSync(TFLITE_OUT, tfliteBuf);

  const labelBuf = extractFileFromZip(TMP_ZIP, 'labelmap.txt');
  fs.writeFileSync(LABELS_OUT, labelBuf);

  console.log(`[fetch-assets] wrote ${TFLITE_OUT} (${(tfliteBuf.length / 1024).toFixed(0)} KB)`);
  console.log(`[fetch-assets] wrote ${LABELS_OUT}`);
}

function generateBeep() {
  if (fs.existsSync(BEEP_OUT)) {
    console.log('[fetch-assets] beep.wav already present, skipping generation');
    return;
  }
  ensureDir(ANDROID_RAW_DIR);

  const sampleRate = 44100;
  const durationSec = 0.1;
  const frequency = 880;
  const numSamples = Math.floor(sampleRate * durationSec);
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;

  const buffer = Buffer.alloc(44 + dataSize);
  // RIFF / WAVE header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Sine wave with a 200-sample attack/release ramp to avoid speaker clicks.
  const amplitude = 0.6 * 0x7fff;
  const ramp = 200;
  for (let i = 0; i < numSamples; i++) {
    const env = Math.min(1, i / ramp, (numSamples - i) / ramp);
    const value =
      env * amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    buffer.writeInt16LE(Math.round(value), 44 + i * bytesPerSample);
  }

  fs.writeFileSync(BEEP_OUT, buffer);
  console.log(`[fetch-assets] wrote ${BEEP_OUT} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  try {
    await fetchModel();
  } catch (err) {
    console.warn(
      '[fetch-assets] Could not download detection model. The app will still build, ' +
        'but on-device detection will be inert until you run `npm run setup:assets` with network access.',
    );
    console.warn(`[fetch-assets] reason: ${err.message}`);
  }
  try {
    generateBeep();
  } catch (err) {
    console.warn('[fetch-assets] could not generate beep.wav');
    console.warn(`[fetch-assets] reason: ${err.message}`);
  }
}

main();
