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
type CanvasBackground = "white" | "black";

const CANVAS_BACKGROUNDS: Record<CanvasBackground, string> = {
  white: "#ffffff",
  black: "#020617",
};
const DRAWING_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='5' fill='none' stroke='%23ffffff' stroke-width='4'/%3E%3Ccircle cx='12' cy='12' r='5' fill='none' stroke='%230f172a' stroke-width='2'/%3E%3Cpath d='M12 1v6M12 17v6M1 12h6M17 12h6' stroke='%23ffffff' stroke-width='4' stroke-linecap='round'/%3E%3Cpath d='M12 1v6M12 17v6M1 12h6M17 12h6' stroke='%230f172a' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\") 12 12, crosshair";

function configureBrush({
  brushSize,
  brushColor,
  canvasBackground,
  canvas,
  disabled,
  fabric,
  tool,
}: {
  brushSize: number;
  brushColor: string;
  canvasBackground: string;
  canvas: import("fabric").Canvas;
  disabled: boolean;
  fabric: typeof import("fabric");
  tool: Tool;
}) {
  canvas.isDrawingMode = !disabled;
  canvas.defaultCursor = disabled ? "default" : DRAWING_CURSOR;
  canvas.freeDrawingCursor = disabled ? "default" : DRAWING_CURSOR;
  canvas.hoverCursor = disabled ? "default" : DRAWING_CURSOR;
  const brush = new fabric.PencilBrush(canvas);
  brush.width = tool === "eraser" ? brushSize * 2 : brushSize;
  brush.color = tool === "eraser" ? canvasBackground : brushColor;
  canvas.freeDrawingBrush = brush;
}

const colorSwatches = [
  "#0f172a",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
];

const extraColorSwatches = [
  "#facc15",
  "#22c55e",
  "#06b6d4",
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
    canvasBackground: CANVAS_BACKGROUNDS.white,
    brushColor: "#0f172a",
    brushSize: 5,
    disabled,
    tool: "brush" as Tool,
  });
  const [tool, setTool] = useState<Tool>("brush");
  const [canvasBackground, setCanvasBackground] = useState<CanvasBackground>("white");
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState("#0f172a");
  const [hexInput, setHexInput] = useState("#0f172a");
  const [canUndo, setCanUndo] = useState(false);
  const canvasBackgroundColor = CANVAS_BACKGROUNDS[canvasBackground];

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => {
    brushOptionsRef.current = {
      canvasBackground: canvasBackgroundColor,
      brushColor,
      brushSize,
      disabled,
      tool,
    };
  }, [brushColor, brushSize, canvasBackgroundColor, disabled, tool]);

  useEffect(() => {
    let mounted = true;

    async function setupCanvas() {
      const fabric = await import("fabric");

      if (!mounted || !canvasElementRef.current || !shellRef.current) {
        return;
      }

      fabricModuleRef.current = fabric;

      const canvas = new fabric.Canvas(canvasElementRef.current, {
        backgroundColor: brushOptionsRef.current.canvasBackground,
        isDrawingMode: true,
        selection: false,
      });

      fabricCanvasRef.current = canvas;
      configureBrush({ canvas, fabric, ...brushOptionsRef.current });

      const emitDraft = () => {
        if (brushOptionsRef.current.disabled) {
          return;
        }

        setCanUndo(canvas.getObjects().length > 0);
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

    configureBrush({
      brushColor,
      brushSize,
      canvas,
      canvasBackground: canvasBackgroundColor,
      disabled,
      fabric,
      tool,
    });
  }, [brushColor, brushSize, canvasBackgroundColor, disabled, tool]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    canvas.backgroundColor = canvasBackgroundColor;
    canvas.renderAll();
    onDraftChangeRef.current?.(canvas.toDataURL({ format: "png", multiplier: 1 }));
  }, [canvasBackgroundColor]);

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
    canvas.backgroundColor = canvasBackgroundColor;
    canvas.renderAll();
    setCanUndo(false);
    onDraftChangeRef.current?.(canvas.toDataURL({ format: "png", multiplier: 1 }));
  };

  const undoLastStroke = () => {
    const canvas = fabricCanvasRef.current;

    if (!canvas || disabled) {
      return;
    }

    const objects = canvas.getObjects();
    const lastObject = objects.at(-1);

    if (!lastObject) {
      return;
    }

    canvas.remove(lastObject);
    canvas.renderAll();
    setCanUndo(canvas.getObjects().length > 0);
    onDraftChangeRef.current?.(canvas.toDataURL({ format: "png", multiplier: 1 }));
  };

  return (
    <section className="rounded-3xl border border-indigo-100 bg-white p-3 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        <Button
          className="min-h-9 rounded-lg px-3 text-xs"
          disabled={disabled}
          onClick={() => setTool("brush")}
          variant={tool === "brush" ? "primary" : "secondary"}
        >
          Brush
        </Button>
        <Button
          className="min-h-9 rounded-lg px-3 text-xs"
          disabled={disabled}
          onClick={() => setTool("eraser")}
          variant={tool === "eraser" ? "primary" : "secondary"}
        >
          Eraser
        </Button>
        </div>
        <label className="ml-1 flex items-center gap-2 text-sm font-bold text-slate-600">
          Size {brushSize}
          <input
            className="accent-indigo-500"
            disabled={disabled}
            max="24"
            min="2"
            onChange={(event) => setBrushSize(Number(event.target.value))}
            type="range"
            value={brushSize}
          />
        </label>
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          {(["white", "black"] as const).map((background) => (
            <Button
              className="min-h-9 rounded-lg px-3 text-xs"
              disabled={disabled}
              key={background}
              onClick={() => setCanvasBackground(background)}
              variant={canvasBackground === background ? "primary" : "secondary"}
            >
              {background === "white" ? "White bg" : "Black bg"}
            </Button>
          ))}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
          Current: {canvasBackground === "white" ? "White (default)" : "Black"}
        </span>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-indigo-50 p-2">
          {colorSwatches.map((color) => (
            <button
              aria-label={`Use ${color}`}
              className={`h-8 w-8 rounded-full border-2 transition ${
                brushColor.toLowerCase() === color.toLowerCase()
                  ? "scale-110 border-indigo-500"
                  : "border-white"
              }`}
              disabled={disabled}
              key={color}
              onClick={() => updateBrushColor(color)}
              style={{ backgroundColor: color }}
              type="button"
            />
          ))}
        </div>
        <details className="relative">
          <summary className="cursor-pointer rounded-2xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">
            More
          </summary>
          <div className="absolute right-0 z-10 mt-2 flex w-44 flex-wrap gap-2 rounded-2xl border border-indigo-100 bg-white p-3 shadow-lg">
            {extraColorSwatches.map((color) => (
              <button
                aria-label={`Use ${color}`}
                className={`h-8 w-8 rounded-full border-2 transition ${
                  brushColor.toLowerCase() === color.toLowerCase()
                    ? "scale-110 border-indigo-500"
                    : "border-indigo-100"
                }`}
                disabled={disabled}
                key={color}
                onClick={() => updateBrushColor(color)}
                style={{ backgroundColor: color }}
                type="button"
              />
            ))}
          </div>
        </details>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            aria-label="Brush color picker"
            className="h-9 w-10 cursor-pointer rounded-xl border border-indigo-100 bg-indigo-50"
            disabled={disabled}
            onChange={(event) => updateBrushColor(event.target.value)}
            type="color"
            value={brushColor}
          />
          <input
            aria-label="Brush hex color"
            className="h-9 w-24 rounded-xl border border-indigo-100 bg-indigo-50 px-2 font-mono text-sm text-slate-700 outline-none focus:border-indigo-400"
            disabled={disabled}
            onChange={(event) => updateHexInput(event.target.value)}
            value={hexInput}
          />
        </label>
        <div className="ml-auto flex gap-2">
          <Button
            className="min-h-9 rounded-xl px-3 text-xs"
            disabled={disabled || !canUndo}
            onClick={undoLastStroke}
            variant="ghost"
          >
            Undo
          </Button>
          <Button className="min-h-9 rounded-xl px-3 text-xs" disabled={disabled} onClick={clearCanvas} variant="ghost">
            Clear
          </Button>
          <Button className="min-h-9 rounded-xl px-3 text-xs" disabled={disabled} onClick={submitDrawing}>
            Submit
          </Button>
        </div>
      </div>
      <div
        ref={shellRef}
        className={`relative touch-none overflow-hidden rounded-2xl border-2 border-slate-200 bg-white ${
          disabled ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <div className="pointer-events-none absolute inset-3 z-10 rounded-xl border-2 border-dashed border-slate-300/80" />
        <canvas ref={canvasElementRef} />
      </div>
    </section>
  );
});

DrawingCanvas.displayName = "DrawingCanvas";
