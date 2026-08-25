import { supabase } from "../config/supabase";

export const fileExistsInBucket = async (
  bucket: string,
  filePath: string,
): Promise<boolean> => {
  const lastSlash = filePath.lastIndexOf("/");

  const folder =
    lastSlash >= 0
      ? filePath.substring(0, lastSlash)
      : "";

  const fileName =
    lastSlash >= 0
      ? filePath.substring(lastSlash + 1)
      : filePath;

  const { data, error } =
    await supabase.storage
      .from(bucket)
      .list(folder, {
        search: fileName,
        limit: 1,
      });

  if (error) {
    console.error(
      `Storage check failed for ${bucket}/${filePath}:`,
      error,
    );

    return false;
  }

  return data?.some(
    (file) => file.name === fileName,
  ) ?? false;
};