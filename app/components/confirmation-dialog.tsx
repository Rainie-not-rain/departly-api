"use client";

import { useEffect, useId, useRef } from "react";
import "./confirmation-dialog.css";

export default function ConfirmationDialog({ title, content, confirmText, onConfirm, onCancel }: { title: string; content: string; confirmText: string; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId(), contentId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="confirmation-dialog" aria-labelledby={titleId} aria-describedby={contentId} onCancel={e => { e.preventDefault(); onCancel(); }}>
    <div className="confirmation-copy"><h2 id={titleId}>{title}</h2><p id={contentId}>{content}</p></div>
    <div className="confirmation-actions"><button autoFocus onClick={onCancel}>取消</button><button onClick={onConfirm}>{confirmText}</button></div>
  </dialog>;
}
