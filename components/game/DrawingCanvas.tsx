"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/Button";

type DrawingCanvasProps = {
  disabled?: boolean;
  onDraftChange?: (dataUrl: string) => void;
  onSubmit: (dataUrl: string) => void;
};

export type DrawingCanvasHandle = {
  submit: () => void;
};

type Tool = "brush" | "eraser";

function configureBrush({
  brushSize,
  brushColor,
  canvas,
  disabled,
  fabric,
  tool,
}: {
  brushSize: number;
  brushColor: string;
  canvas: import("fabric").Canvas;
  disabled: boolean;
  fabric: typeof import("fabric");
  tool: Tool;
}) {
  canvas.isDrawingMode = !disabled;
  const brush = new fabric.PencilBrush(canvas);
  brush.width = tool === "eraser" ? brushSize * 2 : brushSize;
  brush.color = tool === "eraser" ? "#ffffff" : brushColor;
  canvas.freeDrawingBrush = brush;
}

const colorSwatches = [
  "#111827",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ffffff",
];

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
function DrawingCanvas({ disabled = false, onDraftChange, onSubmit }, ref) {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const fabricCanvasRef = useRef<import("fabric").Canvas | null>(null);
  const fabricModuleRef = useRef<typeof import("fabric") | null>(null);
  const onDraftChangeRef = useRef(onDraftChange);
  const brushOptionsRef = useRef({
    brushColor: "#111827",
    brushSize: 5,
    disabled,
    tool: "brush" as Tool,
  });
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState("#111827");
  const [hexInput, setHexInput] = useState("#111827");

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => {
    brushOptionsRef.current = { brushColor, brushSize, disabled, tool };
  }, [brushColor, brushSize, disabled, tool]);

  useEffect(() => {
    let mounted = true;

    async function setupCanvas() {
      const fabric = await import("fabric");

      if (!mounted || !canvasElementRef.current || !shellRef.current) {
        return;
      }

      fabricModuleRef.current = fabric;

      const canvas = new fabric.Canvas(canvasElementRef.current, {
        backgroundColor: "#ffffff",
        isDrawingMode: true,
        selection: false,
      });

      fabricCanvasRef.current = canvas;
      configureBrush({ canvas, fabric, ...brushOptionsRef.current });

      const emitDraft = () => {
        if (brushOptionsRef.current.disabled) {
          return;
        }

        onDraftChangeRef.current?.(canvas.toDataURL({ format: "png", multiplier: 1 }));
      };

      canvas.on("path:created", emitDraft);

      const resize = () => {
        if (!shellRef.current) {
          return;
        }

        const width = shellRef.current.clientWidth;
        const height = Math.max(460, Math.min(720, Math.round(width * 0.66)));
        canvas.setDimensions({ width, height });
        canvas.renderAll();
      };

      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(shellRef.current);

      return () => {
        canvas.off("path:created", emitDraft);
        observer.disconnect();
        canvas.dispose();
      };
    }

    let cleanup: (() => void) | undefined;
    setupCanvas().then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricModuleRef.current;

    if (!canvas || !fabric) {
      return;
    }

    configureBrush({ brushColor, brushSize, canvas, disabled, fabric, tool });
  }, [brushColor, brushSize, disabled, tool]);

  const updateBrushColor = (color: string) => {
    setBrushColor(color);
    setHexInput(color);
    setTool("brush");
  };

  const updateHexInput = (value: string) => {
    setHexInput(value);

    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      setBrushColor(value);
      setTool("brush");
    }
  };

  const submitDrawing = () => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    onSubmit(canvas.toDataURL({ format: "png", multiplier: 1 }));
  };

  useImperativeHandle(ref, () => ({ submit: submitDrawing }));

  const clearCanvas = () => {
    const canvas = fabricCanvasRef.current;

    if (!canvas || disabled) {
      return;
    }

    canvas.clear();
    canvas.backgroundColor = "#ffffff";
    canvas.renderAll();
    onDraftChangeRef.current?.(canvas.toDataURL({ format: "png", multiplier: 1 }));
  };

  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          className="h-9"
          disabled={disabled}
          onClick={() => setTool("brush")}
          variant={tool === "brush" ? "primary" : "secondary"}
        >
          Brush
        </Button>
        <Button
          className="h-9"
          disabled={disabled}
          onClick={() => setTool("eraser")}
          variant={tool === "eraser" ? "primary" : "secondary"}
        >
          Eraser
        </Button>
        <label className="ml-1 flex items-center gap-2 text-sm text-zinc-300">
          Size {brushSize}
          <input
            className="accent-emerald-400"
            disabled={disabled}
            max="24"
            min="2"
            onChange={(event) => setBrushSize(Number(event.target.value))}
            type="range"
            value={brushSize}
          />
        </label>
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-1">
          {colorSwatches.map((color) => (
            <button
              aria-label={`Use ${color}`}
              className={`h-7 w-7 rounded border ${
                brushColor.toLowerCase() === color.toLowerCase()
                  ? "border-emerald-300"
                  : "border-zinc-700"
              }`}
              disabled={disabled}
              key={color}
              onClick={() => updateBrushColor(color)}
              style={{ backgroundColor: color }}
              type="button"
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            aria-label="Brush color picker"
            className="h-9 w-10 cursor-pointer rounded border border-zinc-700 bg-zinc-900"
            disabled={disabled}
            onChange={(event) => updateBrushColor(event.target.value)}
            type="color"
            value={brushColor}
          />
          <input
            aria-label="Brush hex color"
            className="h-9 w-24 rounded-md border border-zinc-700 bg-zinc-900 px-2 font-mono text-sm text-zinc-100 outline-none focus:border-emerald-400"
            disabled={disabled}
            onChange={(event) => updateHexInput(event.target.value)}
            value={hexInput}
          />
        </label>
        <div className="ml-auto flex gap-2">
          <Button className="h-9" disabled={disabled} onClick={clearCanvas} variant="ghost">
            Clear
          </Button>
          <Button className="h-9" disabled={disabled} onClick={submitDrawing}>
            Submit
          </Button>
        </div>
      </div>
      <div
        ref={shellRef}
        className="touch-none overflow-hidden rounded border border-zinc-300 bg-white"
      >
        <canvas ref={canvasElementRef} />
      </div>
    </section>
  );
});

DrawingCanvas.displayName = "DrawingCanvas";
