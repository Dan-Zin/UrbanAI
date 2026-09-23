"use client";

import { useEffect, useRef } from "react";
import type { SiteView } from "@/lib/views";
import { drawSprite } from "@/services/inpaint";
import type { ViewObjectType } from "@/lib/views";
import ViewStatusBadge from "./ViewStatusBadge";

export type MaskTool = "lasso" | "brush" | "rect" | "eraser";

interface Props {
  imageUrl: string | null;
  mask: SiteView["mask"];
  tool: MaskTool;
  status: SiteView["status"];
  groundPoints: { x: number; y: number }[];
  pickingGround: boolean;
  placeMode: boolean;
  anchor: { u: number; v: number };
  preview: { type: ViewObjectType; widthPx: number } | null;
  onMask: (mask: SiteView["mask"]) => void;
  onGroundPoint: (point: { x: number; y: number }) => void;
  onAnchor: (point: { u: number; v: number }) => void;
  onSize: (size: { w: number; h: number }) => void;
}

export default function MaskCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const draftRef = useRef<{ x: number; y: number }[] | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const paint = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !image || !ctx) return;
    const { mask, groundPoints, anchor, preview, placeMode, tool } = propsRef.current;
    const points = draftRef.current ?? mask.points;
    const kind = tool === "brush" ? "brush" : tool === "rect" ? "rect" : "lasso";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    drawMask(ctx, canvas.width, canvas.height, { ...mask, kind, points });
    if (mask.excludeWindows) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.4);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px sans-serif";
      ctx.fillText("окна исключены", 8, 18);
    }
    groundPoints.forEach((p, i) => {
      const x = p.x * canvas.width;
      const y = p.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.font = "11px sans-serif";
      ctx.fillText(String(i + 1), x - 3, y + 3);
    });
    if (placeMode && preview) {
      drawSprite(ctx, preview.type, anchor.u * canvas.width, anchor.v * canvas.height, preview.widthPx);
    }
  };

  useEffect(() => {
    if (!props.imageUrl) {
      imageRef.current = null;
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      imageRef.current = image;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = image.width;
      canvas.height = image.height;
      propsRef.current.onSize({ w: image.width, h: image.height });
      paint();
    };
    image.src = props.imageUrl;
    return () => {
      cancelled = true;
    };
  }, [props.imageUrl]);

  useEffect(() => {
    paint();
  });

  const localPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    return {
      x: Math.min(1, Math.max(0, x / canvas.width)),
      y: Math.min(1, Math.max(0, y / canvas.height)),
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    if (!point) return;
    const current = propsRef.current;
    if (current.pickingGround) {
      current.onGroundPoint(point);
      return;
    }
    if (current.placeMode) {
      current.onAnchor({ u: point.x, v: point.y });
      return;
    }
    if (current.tool === "eraser") {
      current.onMask({ ...current.mask, points: [] });
      draftRef.current = null;
      return;
    }
    draftRef.current = [point];
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draftRef.current) return;
    const point = localPoint(event);
    if (!point) return;
    const tool = propsRef.current.tool;
    if (tool === "rect") draftRef.current = [draftRef.current[0], point];
    else draftRef.current = [...draftRef.current, point];
    paint();
  };

  const onPointerUp = () => {
    const draft = draftRef.current;
    draftRef.current = null;
    if (!draft || draft.length === 0) return;
    const current = propsRef.current;
    const kind = current.tool === "brush" ? "brush" : current.tool === "rect" ? "rect" : "lasso";
    current.onMask({ ...current.mask, kind, points: draft });
  };

  if (!props.imageUrl) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
        Загрузите фото места или снимите кадр в студии
      </div>
    );
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="h-auto w-full touch-none rounded-md bg-black"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="pointer-events-none absolute left-2 top-2">
        <ViewStatusBadge status={props.status} />
      </div>
    </div>
  );
}

function drawMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mask: SiteView["mask"]
) {
  const pts = mask.points;
  if (pts.length === 0) return;
  ctx.save();
  ctx.fillStyle = "rgba(16,185,129,0.35)";
  ctx.strokeStyle = "rgba(110,231,183,0.95)";
  ctx.lineWidth = Math.max(2, width * 0.008);
  const xy = pts.map((p) => ({ x: p.x * width, y: p.y * height }));
  if (mask.kind === "rect" && xy.length >= 2) {
    const a = xy[0];
    const b = xy[xy.length - 1];
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  } else if (mask.kind === "brush") {
    ctx.lineWidth = Math.max(10, width * 0.03);
    ctx.lineCap = "round";
    ctx.beginPath();
    xy.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  } else if (xy.length >= 2) {
    ctx.beginPath();
    xy.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    if (xy.length >= 3) ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
