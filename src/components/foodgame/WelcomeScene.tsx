import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

/**
 * The Food Track title-screen backdrop: a slow carousel of chunky low-poly
 * "food" solids tumbling around the logo under warm kitchen lighting, with a
 * GSAP camera push-in on mount and a light mouse parallax.
 *
 * Self-contained and self-cleaning — it builds its own renderer into the host
 * div and disposes every geometry, material and the context on unmount. Skipped
 * entirely under prefers-reduced-motion (the panel's gradient shows through).
 */
const WelcomeScene = () => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const measure = () => ({ w: host.clientWidth || 1, h: host.clientHeight || 1 });
    const { w: w0, h: h0 } = measure();
    const isNarrow = w0 < 520;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x2a1a10, 0.014);

    const camera = new THREE.PerspectiveCamera(52, w0 / h0, 0.1, 200);
    camera.position.set(0, 2, 46);

    // A blocked or unavailable WebGL context must not take the title screen
    // down with it — the panel's gradient stands in on its own.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !isNarrow, powerPreference: "low-power" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isNarrow ? 1.5 : 2));
    renderer.setSize(w0, h0);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffe6c0, 1.15));
    const key = new THREE.DirectionalLight(0xfff0d0, 1.5);
    key.position.set(6, 12, 10);
    scene.add(key);
    const rim = new THREE.PointLight(0xff9a4d, 90, 60);
    rim.position.set(-12, -6, 14);
    scene.add(rim);

    // Low-poly solids that read as food at a glance: donut, orange, cheese
    // wedge, egg, meatball, carrot.
    const geometries: THREE.BufferGeometry[] = [
      new THREE.TorusGeometry(2.1, 0.95, 10, 20),
      new THREE.IcosahedronGeometry(2.3, 1),
      new THREE.ConeGeometry(2.1, 3.4, 5),
      new THREE.SphereGeometry(2, 12, 9),
      new THREE.DodecahedronGeometry(2.1, 0),
      new THREE.CylinderGeometry(0.5, 1.7, 4, 7),
      new THREE.TorusKnotGeometry(1.5, 0.55, 48, 8),
      new THREE.BoxGeometry(3, 2.2, 2.2),
    ];
    const palette = [0xe8a33d, 0xf2724f, 0xa8c23c, 0x4fb3a8, 0xf3d071, 0xd9553f, 0x8fbf5a, 0xefc07a];

    const materials = palette.map(
      (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.62, metalness: 0.06 }),
    );

    const group = new THREE.Group();
    scene.add(group);

    const count = isNarrow ? 8 : 12;
    const orbiters: { mesh: THREE.Mesh; radius: number; speed: number; phase: number; bob: number; spin: THREE.Vector3 }[] = [];

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometries[i % geometries.length], materials[i % materials.length]);
      const scale = 0.75 + Math.random() * 0.55;
      mesh.scale.setScalar(scale);
      const radius = 13 + Math.random() * 9;
      const phase = (i / count) * Math.PI * 2;
      mesh.position.set(Math.cos(phase) * radius, (Math.random() - 0.5) * 12, Math.sin(phase) * radius);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      group.add(mesh);
      orbiters.push({
        mesh,
        radius,
        speed: 0.1 + Math.random() * 0.12,
        phase,
        bob: Math.random() * Math.PI * 2,
        spin: new THREE.Vector3(Math.random() * 0.5 - 0.25, Math.random() * 0.6 - 0.3, Math.random() * 0.4 - 0.2),
      });
    }

    // Arrival: the whole carousel drops in and the camera pushes through it.
    gsap.from(camera.position, { z: 96, y: 14, duration: 1.6, ease: "power3.out" });
    gsap.from(
      orbiters.map((o) => o.mesh.scale),
      { x: 0, y: 0, z: 0, duration: 1, stagger: 0.05, delay: 0.25, ease: "back.out(2.2)" },
    );

    const pointer = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    host.addEventListener("pointermove", onPointerMove);

    const clock = new THREE.Clock();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();

      for (const o of orbiters) {
        const angle = o.phase + t * o.speed;
        o.mesh.position.x = Math.cos(angle) * o.radius;
        o.mesh.position.z = Math.sin(angle) * o.radius;
        o.mesh.position.y += Math.sin(t * 1.1 + o.bob) * 0.012;
        o.mesh.rotation.x += o.spin.x * 0.01;
        o.mesh.rotation.y += o.spin.y * 0.01;
        o.mesh.rotation.z += o.spin.z * 0.01;
      }

      group.rotation.y = Math.sin(t * 0.12) * 0.18;
      group.rotation.x = Math.sin(t * 0.09) * 0.08;

      // Ease the camera toward the pointer rather than snapping to it.
      camera.position.x += (pointer.x * 4 - camera.position.x) * 0.03;
      camera.position.y += (2 - pointer.y * 3 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const { w, h } = measure();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      gsap.killTweensOf(camera.position);
      orbiters.forEach((o) => gsap.killTweensOf(o.mesh.scale));
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />;
};

export default WelcomeScene;
