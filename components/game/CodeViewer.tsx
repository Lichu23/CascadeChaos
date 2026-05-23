"use client";

import { useState } from "react";

type CodeViewerProps = {
  html: string;
  css: string;
};

export function CodeViewer({ html, css }: CodeViewerProps) {
  const [activeTab, setActiveTab] = useState<"html" | "css">("html");
  const source = activeTab === "html" ? html : css;

  return (
    <section className="flex min-h-0 flex-col rounded-md border border-zinc-800 bg-zinc-950">
      <div className="flex border-b border-zinc-800 p-1">
        <button
          className={`h-9 rounded px-3 text-sm font-semibold ${
            activeTab === "html"
              ? "bg-zinc-100 text-zinc-950"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          }`}
          onClick={() => setActiveTab("html")}
          type="button"
        >
          HTML
        </button>
        <button
          className={`h-9 rounded px-3 text-sm font-semibold ${
            activeTab === "css"
              ? "bg-zinc-100 text-zinc-950"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          }`}
          onClick={() => setActiveTab("css")}
          type="button"
        >
          CSS
        </button>
      </div>
      <pre className="min-h-[360px] overflow-auto p-4 text-[13px] leading-6 text-zinc-200">
        <code>{source}</code>
      </pre>
    </section>
  );
}

