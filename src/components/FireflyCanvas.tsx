import { useEffect, useRef } from "react";
import * as THREE from "three";

interface FireflyCanvasProps {
  /** Number of motes. The dashboard uses the default; the landing page more. */
  count?: number;
}

/**
 * Ambient three.js layer: warm firefly motes drifting over the wooden table,
 * with a gentle mouse parallax. Renders into a fixed, pointer-transparent
 * full-screen canvas behind the dashboard content. Skipped entirely for
 * users who prefer reduced motion.
 */
const FireflyCanvas = ({ count: COUNT = 90 }: FireflyCanvasProps) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 500);
    camera.position.z = 140;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    // Soft round glow sprite, drawn once onto a tiny canvas.
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = spriteCanvas.height = 64;
    const ctx = spriteCanvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 224, 150, 1)");
    grad.addColorStop(0.35, "rgba(255, 196, 100, 0.5)");
    grad.addColorStop(1, "rgba(255, 196, 100, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(spriteCanvas);

    // Scatter the motes through a shallow box in front of the camera.
    const SPREAD_X = 190;
    const SPREAD_Y = 110;
    const SPREAD_Z = 80;
    const positions = new Float32Array(COUNT * 3);
    const seeds: { ax: number; ay: number; speed: number; phase: number }[] = [];
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * SPREAD_X;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * SPREAD_Y;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * SPREAD_Z;
      seeds.push({
        ax: 4 + Math.random() * 10,
        ay: 3 + Math.random() * 8,
        speed: 0.12 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }
    const basePositions = positions.slice();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 5.5,
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffc37a,
      opacity: 0.85,
      sizeAttenuation: true,
    });
    scene.add(new THREE.Points(geometry, material));

    const mouse = { x: 0, y: 0 };
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < COUNT; i++) {
        const s = seeds[i];
        attr.setX(i, basePositions[i * 3] + Math.sin(t * s.speed + s.phase) * s.ax);
        attr.setY(i, basePositions[i * 3 + 1] + Math.cos(t * s.speed * 0.9 + s.phase * 1.3) * s.ay);
      }
      attr.needsUpdate = true;
      // Slow collective shimmer + parallax toward the pointer.
      material.opacity = 0.65 + Math.sin(t * 0.8) * 0.2;
      camera.position.x += (mouse.x * 6 - camera.position.x) * 0.03;
      camera.position.y += (-mouse.y * 4 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} aria-hidden className="pointer-events-none fixed inset-0 z-0" />;
};

export default FireflyCanvas;
