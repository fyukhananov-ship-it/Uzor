"use client";

import { useState } from "react";

export function ShareActions({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}/p/${token}`;
    try {
      if (navigator.share) {
        await navigator.share({ url, title: "Разбор пары" });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Пользователь отменил Web Share — это не ошибка.
    }
  }

  return (
    <button onClick={copyLink} className="btn-secondary" type="button">
      {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
    </button>
  );
}
