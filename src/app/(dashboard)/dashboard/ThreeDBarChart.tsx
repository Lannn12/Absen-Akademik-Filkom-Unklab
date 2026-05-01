'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';

interface TingkatData {
  name: string;
  hadir: number;
  tidakHadir: number;
}

export default function ThreeDBarChart({ data }: { data: TingkatData[] }) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.hadir + d.tidakHadir), 1);
  const scaleY = 5 / maxVal; 

  const totalWidth = data.length * 2.5;

  return (
    <Canvas camera={{ position: [0, 4, 10], fov: 50 }} shadows>
      <color attach="background" args={['transparent']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <pointLight position={[-10, 5, -10]} intensity={0.5} />

      <OrbitControls
        makeDefault
        autoRotate
        autoRotateSpeed={0.8}
        enableZoom={true}
        maxPolarAngle={Math.PI / 2 + 0.1}
      />

      <group position={[-(totalWidth) / 2 + 1.25, -2, 0]}>
        {data.map((d, i) => {
          const hadirHeight = d.hadir * scaleY;
          const tidakHadirHeight = d.tidakHadir * scaleY;
          const xPos = i * 2.5;

          return (
            <group key={i} position={[xPos, 0, 0]}>
              <Text
                position={[0, -0.6, 0]}
                fontSize={0.4}
                color="#64748b"
                anchorX="center"
                anchorY="middle"
              >
                {d.name}
              </Text>

              {hadirHeight > 0 && (
                <mesh position={[0, hadirHeight / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[1, hadirHeight, 1]} />
                  <meshStandardMaterial color="#10b981" />
                </mesh>
              )}

              {tidakHadirHeight > 0 && (
                <mesh position={[0, hadirHeight + tidakHadirHeight / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[1, tidakHadirHeight, 1]} />
                  <meshStandardMaterial color="#334155" />
                </mesh>
              )}

              <Text
                position={[0, hadirHeight + tidakHadirHeight + 0.5, 0]}
                fontSize={0.3}
                color="#f8fafc"
                anchorX="center"
                anchorY="middle"
              >
                {d.hadir > 0 || d.tidakHadir > 0 ? `${d.hadir}/${d.hadir + d.tidakHadir}` : ''}
              </Text>
            </group>
          );
        })}
      </group>

      <gridHelper args={[20, 20, '#1e293b', '#e2e8f0']} position={[0, -2, 0]} />
    </Canvas>
  );
}
