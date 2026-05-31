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
    <section className="flex min-h-0 flex-col rounded-3xl bg-indigo-950 text-indigo-100 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
      <div className="flex gap-1 border-b border-indigo-900 p-2">
        <button
          className={`h-9 rounded-xl px-3 text-sm font-bold transition ${
            activeTab === "html"
              ? "bg-white text-indigo-700"
              : "text-indigo-200 hover:bg-indigo-900"
          }`}
          onClick={() => setActiveTab("html")}
          type="button"
        >
          HTML
        </button>
        <button
          className={`h-9 rounded-xl px-3 text-sm font-bold transition ${
            activeTab === "css"
              ? "bg-white text-indigo-700"
              : "text-indigo-200 hover:bg-indigo-900"
          }`}
          onClick={() => setActiveTab("css")}
          type="button"
        >
          CSS
        </button>
      </div>
      <pre className="min-h-[320px] overflow-auto p-4 font-mono text-[11px] leading-relaxed text-indigo-100">
        <code>{source}</code>
      </pre>
    </section>
  );
}

