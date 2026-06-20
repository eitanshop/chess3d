import React, { useRef, useMemo, useEffect } from 'react';
import { MeshStandardMaterial, Vector3, Group, MathUtils, Texture } from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { PieceSetType } from '../../types';

// --- TEXTURE URLS ---
const WOOD_TEXTURE_URL = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/hardwood2_diffuse.jpg";
const STONE_TEXTURE_URL = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg"; 

const HIGHLIGHT_COLOR = "#00BFFF"; // Neon Blue for selection

interface PieceProps {
  position: [number, number, number];
  color: 'w' | 'b';
  isSelected?: boolean;
  onClick?: () => void;
  startPosition?: [number, number, number];
  isCaptured?: boolean;
  pieceSet: PieceSetType;
}

const BaseMaterial: React.FC<{ color: 'w' | 'b', isSelected?: boolean, opacity?: number, pieceSet: PieceSetType }> = ({ color, isSelected, opacity = 1, pieceSet }) => {
  const isWhite = color === 'w';

  // Load textures using Suspense-friendly hook
  const textures = useTexture({
    wood: WOOD_TEXTURE_URL,
    stone: STONE_TEXTURE_URL,
  });

  // Determine Material Properties based on Set
  const materialProps = useMemo(() => {
    // If selected, override everything with a glowing highlight style
    if (isSelected) {
        return { 
            color: HIGHLIGHT_COLOR, 
            roughness: 0.2, 
            metalness: 0.8,
            map: null
        };
    }

    switch (pieceSet) {
        case 'wood':
            return {
                // Classic Natural Wood Tones
                color: isWhite ? "#deb887" : "#654321", 
                roughness: 0.4, 
                metalness: 0.0, 
                map: textures.wood
            };
        case 'stone':
            return {
                color: isWhite ? "#d1d5db" : "#4b5563",
                roughness: 0.9, 
                metalness: 0.1,
                map: textures.stone
            };
        case 'plastic':
            return {
                // Pure colors, smooth, no texture
                color: isWhite ? "#ffffff" : "#222222",
                roughness: 0.2, 
                metalness: 0.0, 
                map: null // EXPLICIT NULL to remove texture
            };
        case 'standard':
        default:
            return {
                // Shiny Metal (Gold/Silver), no texture
                color: isWhite ? "#E0E0E0" : "#FFD700",
                roughness: 0.2, 
                metalness: 0.8,  
                map: null // EXPLICIT NULL to remove texture
            };
    }
  }, [pieceSet, isWhite, isSelected, textures]);
  
  return (
    <meshStandardMaterial 
      color={materialProps.color}
      roughness={materialProps.roughness}
      metalness={materialProps.metalness}
      map={materialProps.map || null} 
      envMapIntensity={pieceSet === 'standard' ? 1.5 : 0.5}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );
};

// --- ANIMATION WRAPPER ---
const AnimatedPieceWrapper: React.FC<PieceProps & { children: React.ReactNode }> = ({ 
    position, 
    startPosition, 
    isCaptured,
    children, 
    onClick 
}) => {
    const groupRef = useRef<Group>(null);
    const targetPos = useMemo(() => new Vector3(...position), [position]);
    
    useEffect(() => {
        if (startPosition && groupRef.current) {
            groupRef.current.position.set(...startPosition);
        } else if (groupRef.current) {
             groupRef.current.position.set(...position);
        }
    }, [startPosition]);

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        if (isCaptured) {
            groupRef.current.rotation.y += delta * 5;
            groupRef.current.rotation.z += delta * 2;
            groupRef.current.position.y += delta * 1; 
            
            const currentScale = groupRef.current.scale.x;
            const newScale = MathUtils.lerp(currentScale, 0, delta * 4);
            groupRef.current.scale.setScalar(newScale);
            return;
        }

        groupRef.current.position.lerp(targetPos, delta * 10);
    });

    return (
        <group 
            ref={groupRef} 
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        >
            {children}
        </group>
    );
};

export const Pawn: React.FC<PieceProps> = (props) => {
  return (
    <AnimatedPieceWrapper {...props}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.2, 32]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.15, 0.25, 0.6, 32]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
    </AnimatedPieceWrapper>
  );
};

export const Rook: React.FC<PieceProps> = (props) => {
  return (
    <AnimatedPieceWrapper {...props}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 1.2, 32]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.35, 0.25, 0.3, 6]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
    </AnimatedPieceWrapper>
  );
};

export const Knight: React.FC<PieceProps> = (props) => {
  const rotationY = props.color === 'w' ? Math.PI : 0;
  return (
    <AnimatedPieceWrapper {...props}>
        <group rotation={[0, rotationY, 0]}>
            <mesh position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.3, 0.35, 0.4, 32]} />
                <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
            </mesh>
            <mesh position={[0, 0.8, -0.1]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.25, 1.0, 0.4]} />
                <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
            </mesh>
            <mesh position={[0, 1.2, 0.3]} rotation={[0.1, 0, 0]}>
                <boxGeometry args={[0.22, 0.4, 0.5]} />
                <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
            </mesh>
            <mesh position={[-0.1, 1.5, 0.0]}>
                <coneGeometry args={[0.05, 0.2, 8]} />
                <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
            </mesh>
            <mesh position={[0.1, 1.5, 0.0]}>
                <coneGeometry args={[0.05, 0.2, 8]} />
                <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
            </mesh>
        </group>
    </AnimatedPieceWrapper>
  );
};

export const Bishop: React.FC<PieceProps> = (props) => {
  return (
    <AnimatedPieceWrapper {...props}>
       <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.2, 0.3, 1.2, 32]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
      <mesh position={[0, 1.3, 0]} scale={[1, 1.5, 1]}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
    </AnimatedPieceWrapper>
  );
};

export const Queen: React.FC<PieceProps> = (props) => {
  return (
    <AnimatedPieceWrapper {...props}>
       <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.35, 0.4, 0.2, 32]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.2, 0.3, 1.4, 32]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.3, 0.1, 0.4, 12]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
    </AnimatedPieceWrapper>
  );
};

export const King: React.FC<PieceProps> = (props) => {
  return (
    <AnimatedPieceWrapper {...props}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.35, 0.4, 0.2, 32]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.25, 0.35, 1.6, 32]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[0.15, 0.4, 0.15]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
       <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[0.3, 0.15, 0.15]} />
        <BaseMaterial color={props.color} isSelected={props.isSelected} pieceSet={props.pieceSet} />
      </mesh>
    </AnimatedPieceWrapper>
  );
};