import { supabase } from "../config/supabase";
import { getStoragePathFromUrl } from "./getStoragePathFromUrl";

export const deleteExpiredOrderPhotos = async () => {
  try {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - 15);

    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, photo_urls, created_at")
      .lt("created_at", expiryDate.toISOString())
      .not("photo_urls", "is", null);

    if (error) {
      console.error("Error fetching expired orders:", error);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log("No expired order photos found.");
      return;
    }

    for (const order of orders) {
      const photoUrls: string[] = Array.isArray(order.photo_urls)
        ? order.photo_urls
        : [];
      const photoPaths = photoUrls
        .map((photoUrl: string) =>
          getStoragePathFromUrl(photoUrl, "orderPhotos", true),
        )
        .filter((photoPath): photoPath is string => Boolean(photoPath))
        .map((photoPath) => photoPath.replace(/^\/+/, ""));

      if (photoPaths.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from("orderPhotos")
          .remove(photoPaths);

        if (deleteError) {
          console.error(
            `Failed to delete photos for order ${order.id}:`,
            deleteError,
          );
          continue;
        }
      }

      // Clear photo references from database
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          photo_urls: [],
        })
        .eq("id", order.id);

      if (updateError) {
        console.error(
          `Photos deleted but DB update failed for order ${order.id}:`,
          updateError,
        );
        continue;
      }

      console.log(`Deleted order photos for order ${order.id}`);
    }
  } catch (error) {
    console.error("Expired order photo cleanup error:", error);
  }
};