"use client";

import { useEffect, useRef } from "react";

type NodePoint = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isWhitelist: boolean;
};

const MIN_SPEED_PX_SEC = 38;
const SPEED_RANGE_PX_SEC = 17;
const LINE_BASE_ALPHA = 0.396;

function targetNodeCount(width: number, height: number): number {
  if (width < 1024) return 18;
  return Math.min(36, Math.max(28, Math.round((width * height) / 42_000)));
}

function createNode(index: number, width: number, height: number): NodePoint {
  const angle = Math.random() * Math.PI * 2;
  const speed = MIN_SPEED_PX_SEC + Math.random() * SPEED_RANGE_PX_SEC;
  return {
    x: Math.random() * Math.max(width, 1),
    y: Math.random() * Math.max(height, 1),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    isWhitelist: index % 5 === 0,
  };
}

function computeMaxDist(width: number, height: number): number {
  return Math.min(Math.max(Math.min(width, height) * 0.28, 120), 220);
}

/**
 * Họa tiết nền "Mạng Node x402" đặt cố định phía sau toàn bộ Dashboard.
 * Thuần 2D Canvas, tôn trọng `prefers-reduced-motion` và tự tạm dừng khi tab bị ẩn.
 */
export function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let nodes: NodePoint[] = Array.from({ length: targetNodeCount(width, height) }, (_, i) =>
      createNode(i, width, height),
    );
    let rafId: number | null = null;
    let lastTime = performance.now();

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncCanvasSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const desired = targetNodeCount(width, height);
      if (nodes.length < desired) {
        for (let i = nodes.length; i < desired; i++) {
          nodes.push(createNode(i, width, height));
        }
      } else if (nodes.length > desired) {
        nodes = nodes.slice(0, desired);
      }

      for (const n of nodes) {
        if (n.x > width) n.x = Math.max(0, width - 2);
        if (n.y > height) n.y = Math.max(0, height - 2);
      }
    };

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);

      const maxDist = computeMaxDist(width, height);
      const maxDistSq = maxDist * maxDist;
      ctx.lineWidth = 1;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq >= maxDistSq) continue;
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / maxDist) * LINE_BASE_ALPHA;
          ctx.strokeStyle = `rgba(34, 211, 238, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const n of nodes) {
        ctx.fillStyle = n.isWhitelist ? "rgba(74, 222, 128, 0.95)" : "rgba(103, 232, 249, 0.76)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.isWhitelist ? 2.4 : 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = (now: number) => {
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 0.05);
      lastTime = now;

      for (const n of nodes) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x <= 0) {
          n.x = 0;
          n.vx = Math.abs(n.vx);
        } else if (n.x >= width) {
          n.x = width;
          n.vx = -Math.abs(n.vx);
        }
        if (n.y <= 0) {
          n.y = 0;
          n.vy = Math.abs(n.vy);
        } else if (n.y >= height) {
          n.y = height;
          n.vy = -Math.abs(n.vy);
        }
      }

      drawFrame();
      rafId = window.requestAnimationFrame(step);
    };

    const stopLoop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const syncLoop = () => {
      if (reducedMotionQuery.matches || document.hidden) {
        stopLoop();
        drawFrame();
        return;
      }
      if (rafId === null) {
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(step);
      }
    };

    const handleResize = () => {
      syncCanvasSize();
      drawFrame();
    };

    syncCanvasSize();
    drawFrame();
    syncLoop();

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", syncLoop);
    reducedMotionQuery.addEventListener("change", syncLoop);

    return () => {
      stopLoop();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", syncLoop);
      reducedMotionQuery.removeEventListener("change", syncLoop);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full" />;
}
