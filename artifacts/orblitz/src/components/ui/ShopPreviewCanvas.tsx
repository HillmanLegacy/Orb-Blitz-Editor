import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { RingStyle } from "@/lib/stores/useShop";
import { OrbitalRings } from "@/components/game/OrbitalRings";
import { ShopItemPreviewScene, type ShopItemPreviewCategory } from "./ShopItemPreview";

type PreviewCategory = ShopItemPreviewCategory | "aura";

function PreviewFallback({ name, color, message = "Preview unavailable" }: {
  name: string;
  color: string;
  message?: string;
}) {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "grid",
      placeItems: "center",
      padding: 20,
      color: `${color}b8`,
      background: "radial-gradient(ellipse at center, rgba(0,18,38,0.98), rgba(0,0,8,1))",
      textAlign: "center",
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: "0.12em",
      lineHeight: 1.6,
      textTransform: "uppercase",
    }}>
      <span>{message}<br />{name}</span>
    </div>
  );
}

class PreviewCanvasBoundary extends Component<{
  children: ReactNode;
  fallback: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function detectWebGl(): boolean {
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2") || probe.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function PreviewFrameScheduler() {
  const { invalidate } = useThree();

  useEffect(() => {
    // Preview animation is decorative. A bounded 20fps invalidation loop keeps
    // one intentional preview lively without competing with the game canvas.
    const handle = window.setInterval(invalidate, 1000 / 20);
    invalidate();
    return () => window.clearInterval(handle);
  }, [invalidate]);

  return null;
}

function AuraPreviewScene({ style }: { style: RingStyle }) {
  const groupRef = useRef<THREE.Group>(null);
  const orbMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color("#0d1b2a"),
    metalness: 0.65,
    roughness: 0.30,
    emissive: new THREE.Color("#0a1020"),
    emissiveIntensity: 0.5,
  }), []);

  useEffect(() => () => orbMat.dispose(), [orbMat]);

  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.getElapsedTime() * 0.55;
  });

  return (
    <group ref={groupRef}>
      <mesh material={orbMat}>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      <OrbitalRings style={style} scale={1} />
    </group>
  );
}

export function ShopPreviewCanvas({
  category,
  value,
  color,
  name,
}: {
  category: PreviewCategory;
  value: string;
  color: string;
  name: string;
}) {
  const isAura = category === "aura";
  const [webGlAvailable, setWebGlAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setWebGlAvailable(detectWebGl());
  }, []);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      paddingBottom: 12,
      borderBottom: `1px solid ${color}1e`,
      marginBottom: 8,
    }}>
      <div style={{
        width: isAura ? 180 : 200,
        height: isAura ? 180 : 158,
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${color}38`,
        background: "radial-gradient(ellipse at center, rgba(0,8,22,0.97) 0%, rgba(0,0,8,0.99) 100%)",
        boxShadow: `0 0 24px ${color}18, inset 0 0 20px rgba(0,0,0,0.5)`,
        flexShrink: 0,
      }}>
        {webGlAvailable ? (
          <PreviewCanvasBoundary fallback={<PreviewFallback name={name} color={color} />}>
            <Canvas
              frameloop="demand"
              fallback={<PreviewFallback name={name} color={color} />}
              camera={isAura
                ? { position: [0, 0.4, 4.2], fov: 46 }
                : { position: [0, 0.25, 5.5], fov: 50 }}
              style={{ width: "100%", height: "100%" }}
              gl={{ antialias: isAura, alpha: true, powerPreference: "low-power" }}
              dpr={[1, 1.25]}
            >
              <PreviewFrameScheduler />
              {isAura ? (
                <>
                  <ambientLight intensity={0.18} />
                  <AuraPreviewScene style={value as RingStyle} />
                </>
              ) : (
                <ShopItemPreviewScene category={category} value={value} />
              )}
            </Canvas>
          </PreviewCanvasBoundary>
        ) : (
          <PreviewFallback
            name={name}
            color={color}
            message={webGlAvailable === null ? "Loading preview" : "WebGL preview unavailable"}
          />
        )}
      </div>
      <p style={{
        color: `${color}aa`,
        fontSize: "9px",
        fontWeight: 900,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        textAlign: "center",
      }}>
        {name}
      </p>
    </div>
  );
}