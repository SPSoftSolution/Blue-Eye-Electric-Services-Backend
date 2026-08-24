export const getStoragePathFromUrl = (
  url: string,
  bucket: string,
  isPublic: boolean,
): string | null => {
  try {
    const parsedUrl = new URL(url);

    const marker = isPublic ? `/storage/v1/object/public/${bucket}`: bucket;

    const index = parsedUrl.pathname.indexOf(marker);

    if (index === -1) {
      return null;
    }

    return decodeURIComponent(
      parsedUrl.pathname.slice(
        index + marker.length,
      ),
    );
  } catch {
    return null;
  }
};