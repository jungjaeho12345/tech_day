// @MX:NOTE: [AUTO] Clipboard-paste embed helpers (news.md 기사 에디터: 클립보드에서 복사하여 붙여넣기한
// 이미지/유투브를 임베딩한다). Pure, dependency-free, unit-testable helpers used by WritePage's BodyEditor
// onPaste handler. The 10%x10% sizing is handled by the existing .yh-embed CSS — no size logic here.

// Match a YouTube watch/short URL. Accepts:
//   - youtube.com/watch?v=ID  (with optional extra query params, www./m. subdomains, http/https)
//   - youtu.be/ID            (short link)
//   - youtube.com/shorts/ID  (shorts)
const YOUTUBE_RE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^ ]*&)?v=|shorts\/)|youtu\.be\/)[\w-]{6,}/i;

/**
 * Whether `text` is a YouTube video URL (watch / youtu.be / shorts). Trims surrounding whitespace so a
 * pasted URL with a trailing newline still matches. Returns false for non-strings and empty input.
 * @param {string} text
 * @returns {boolean}
 */
export function isYouTubeUrl(text) {
  if (typeof text !== 'string') return false;
  return YOUTUBE_RE.test(text.trim());
}

/**
 * Find the first image item in a clipboard DataTransferItemList and return it as a File, else null.
 * Resilient to jsdom (items may be undefined). Used to detect a pasted image (REQ: clipboard image embed).
 * @param {DataTransferItemList|undefined} items
 * @returns {File|null}
 */
export function findClipboardImageFile(items) {
  if (!items) return null;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item && item.kind === 'file' && typeof item.type === 'string' && item.type.startsWith('image/')) {
      const file = item.getAsFile?.();
      if (file) return file;
    }
  }
  return null;
}

/**
 * Read a File/Blob as a data URL via FileReader. Resolves with the data URL string, rejects on error.
 * Wrapped in a Promise so the caller can await it before inserting the embed.
 * @param {Blob} file
 * @returns {Promise<string>}
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}
