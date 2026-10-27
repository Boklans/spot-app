export const MediaTypeOptions = {
  All: 'All',
  Videos: 'Videos',
  Images: 'Images',
} as const;

export async function requestMediaLibraryPermissionsAsync() {
  return { status: 'granted', granted: true };
}

export async function requestCameraPermissionsAsync() {
  return { status: 'granted', granted: true };
}

function pickAndCompressImageWeb(captureMode?: 'user' | 'environment'): Promise<{
  canceled: boolean;
  assets: Array<{ uri: string; width?: number; height?: number }>;
}> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ canceled: true, assets: [] });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (captureMode) {
      input.setAttribute('capture', captureMode);
    }

    let settled = false;
    const finish = (result: {
      canceled: boolean;
      assets: Array<{ uri: string; width?: number; height?: number }>;
    }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      const file = target?.files?.[0];
      if (!file) {
        finish({ canceled: true, assets: [] });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const rawDataUrl = reader.result as string;
        const img = new window.Image();
        img.onload = () => {
          try {
            const targetSize = 320;
            const canvas = document.createElement('canvas');
            canvas.width = targetSize;
            canvas.height = targetSize;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Center-crop to square
              const minSide = Math.min(img.width, img.height);
              const sx = (img.width - minSide) / 2;
              const sy = (img.height - minSide) / 2;
              ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
              const compressedUri = canvas.toDataURL('image/jpeg', 0.84);
              finish({
                canceled: false,
                assets: [{ uri: compressedUri, width: targetSize, height: targetSize }],
              });
              return;
            }
          } catch {
            // Fallback to raw data URL if canvas fails
          }
          finish({
            canceled: false,
            assets: [{ uri: rawDataUrl }],
          });
        };
        img.onerror = () => {
          finish({
            canceled: false,
            assets: [{ uri: rawDataUrl }],
          });
        };
        img.src = rawDataUrl;
      };
      reader.onerror = () => finish({ canceled: true, assets: [] });
      reader.readAsDataURL(file);
    };

    input.oncancel = () => finish({ canceled: true, assets: [] });
    input.click();
  });
}

export async function launchImageLibraryAsync(_options?: Record<string, unknown>): Promise<{
  canceled: boolean;
  assets: Array<{ uri: string; width?: number; height?: number }>;
}> {
  return pickAndCompressImageWeb();
}

export async function launchCameraAsync(_options?: Record<string, unknown>): Promise<{
  canceled: boolean;
  assets: Array<{ uri: string; width?: number; height?: number }>;
}> {
  return pickAndCompressImageWeb('user');
}
