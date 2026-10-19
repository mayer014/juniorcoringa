import { notFound } from "next/navigation";
import { PostEditor } from "@/components/admin/post-editor";
import { getPostById } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = getPostById(Number(id));
  if (!post) notFound();
  return <PostEditor post={post} />;
}
