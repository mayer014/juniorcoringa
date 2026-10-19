"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeletePostButton({ id, title }: { id: number; title: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function remove() {
    if (!window.confirm(`Excluir “${title}”? Esta ação não pode ser desfeita.`)) return;
    setLoading(true);
    const response = await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });
    setLoading(false);
    if (!response.ok) {
      window.alert("Não foi possível excluir a publicação.");
      return;
    }
    router.refresh();
  }

  return <button type="button" className="icon-action icon-action--danger" onClick={remove} disabled={loading} aria-label={`Excluir ${title}`}><Trash2 size={17} /></button>;
}
