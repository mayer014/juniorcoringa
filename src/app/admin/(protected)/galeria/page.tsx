import { GalleryManager } from "@/components/admin/gallery-manager";
import { listAllGalleryItems, listPublishedPostOptions } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function GalleryAdminPage() {
  return <GalleryManager initialItems={listAllGalleryItems()} postOptions={listPublishedPostOptions()} />;
}
