import { Sky } from '@react-three/drei'

export function OceanAtmosphere() {
  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[70, 40, 30]}
        inclination={0.48}
        azimuth={0.2}
        mieCoefficient={0.012}
        mieDirectionalG={0.86}
        rayleigh={0.85}
        turbidity={7}
      />
      <hemisphereLight args={['#bce8ef', '#04131e', 1.35]} />
      <directionalLight
        position={[50, 70, 35]}
        color="#fff0cf"
        intensity={2.5}
      />
      <fog attach="fog" args={['#4a7181', 68, 155]} />
    </>
  )
}
