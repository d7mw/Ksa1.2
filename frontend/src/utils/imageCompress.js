// Image compression utility - compresses uploaded images to keep base64 payload small
// to avoid proxy/ingress body-size limits and slow uploads.

const MAX_DIMENSION = 1600; // Max width or height in pixels
const TARGET_BYTES = 900_000; // ~900KB raw target (after base64: ~1.2MB string)

/**
 * Loads a File and returns a compressed base64 dataURL.
 * Iteratively reduces JPEG quality until under target size.
 */
export const compressImage = (file, opts = {}) =>
  new Promise((resolve, reject) => {
    if (!file) return reject(new Error('no_file'));
    const maxDim = opts.maxDimension || MAX_DIMENSION;
    const target = opts.targetBytes || TARGET_BYTES;

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_error'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('image_error'));
      img.onload = () => {
        let { width, height } = img;
        // Scale down preserving aspect ratio
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Iteratively compress until under target bytes (base64 char ~= 1 byte after decoding minus 33%)
        let quality = 0.92;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length * 0.75 > target && quality > 0.4) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
