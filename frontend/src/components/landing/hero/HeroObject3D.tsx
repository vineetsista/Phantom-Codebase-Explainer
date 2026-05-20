"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { Suspense, useRef } from "react";
import * as THREE from "three";

/**
 * Abstract floating 3D element for the hero — a wireframe torus knot pierced
 * by a smaller solid icosahedron, with a soft particle field orbiting both.
 * Slow rotation + subtle parallax tied to cursor position.
 *
 * SSR-safe wrapping (Suspense + dynamic import from the parent) keeps Next.js
 * from trying to render Three.js on the server.
 */

function ParallaxRig({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const { x, y } = state.pointer;
    ref.current.rotation.y = THREE.MathUtils.lerp(
      ref.current.rotation.y,
      x * 0.6 + state.clock.elapsedTime * 0.08,
      0.04,
    );
    ref.current.rotation.x = THREE.MathUtils.lerp(
      ref.current.rotation.x,
      -y * 0.4 + Math.sin(state.clock.elapsedTime * 0.3) * 0.06,
      0.04,
    );
  });

  return <group ref={ref}>{children}</group>;
}

function Knot() {
  return (
    <mesh>
      <torusKnotGeometry args={[1.2, 0.28, 256, 32, 2, 3]} />
      <meshBasicMaterial
        color="#00F0FF"
        wireframe
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

function Core() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = state.clock.elapsedTime * 0.4;
    ref.current.rotation.y = state.clock.elapsedTime * 0.25;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.55, 0]} />
      <meshStandardMaterial
        color="#7B61FF"
        emissive="#7B61FF"
        emissiveIntensity={1.2}
        roughness={0.4}
        metalness={0.85}
      />
    </mesh>
  );
}

function Particles({ count = 220 }: { count?: number }) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 2.6 + Math.random() * 1.2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.05;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#00F0FF"
        size={0.025}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function HeroObject3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <color attach="background" args={["#050507"]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[3, 3, 4]} intensity={1.8} color="#00F0FF" />
        <pointLight position={[-3, -2, -2]} intensity={1.3} color="#7B61FF" />
        <ParallaxRig>
          <Float speed={1.4} rotationIntensity={0.35} floatIntensity={0.6}>
            <Knot />
            <Core />
          </Float>
          <Particles />
        </ParallaxRig>
      </Suspense>
    </Canvas>
  );
}
