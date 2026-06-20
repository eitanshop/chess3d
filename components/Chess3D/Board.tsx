import React, { useMemo } from 'react';
import { Text, useTexture } from '@react-three/drei';
import { RepeatWrapping } from 'three';
import { BoardStyle } from '../../types';

interface BoardProps {
  onSquareClick: (square: string) => void;
  validMoves: string[]; 
  lastMove?: { from: string, to: string };
  checkSquare?: string;
  boardStyle: BoardStyle;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

// --- TEXTURE URLS ---
const WOOD_TEXTURE_URL = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/hardwood2_diffuse.jpg";
const MARBLE_TEXTURE_URL = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg"; // Used for noise/stone detail

// --- STYLE DEFINITIONS ---
const getBoardColors = (style: BoardStyle, isBlack: boolean) => {
    switch (style) {
        case 'marble':
            // Classic Green/White Tournament style
            return isBlack ? "#4a7a4a" : "#eaeee0";
        case 'glass':
            // Dark Blue / Light Ice
            return isBlack ? "#1e3a8a" : "#cbd5e1";
        case 'slate':
            // Industrial Grey / Concrete
            return isBlack ? "#374151" : "#9ca3af";
        case 'stone':
            // Jerusalem Stone (Gold/Beige vs Brown)
            return isBlack ? "#99825d" : "#f2eecb";
        case 'wood':
        default:
             // Revised to much lighter Sand/Cream colors to contrast with Dark Brown pieces
             // Dark Square: Light Sand / Tan
             // Light Square: Off-white / Cream
            return isBlack ? "#c2a689" : "#f5e6d3";
    }
};

const getBorderColor = (style: BoardStyle) => {
    switch (style) {
        case 'marble': return "#2f3e2f";
        case 'glass': return "#0f172a";
        case 'slate': return "#111827";
        case 'stone': return "#594d3e"; // Dark stone brown
        case 'wood': default: return "#3e2723";
    }
};

// --- Material Component ---
const StyledSquareMaterial: React.FC<{ style: BoardStyle, isBlack: boolean, color: string }> = ({ style, isBlack, color }) => {
  const textures = useTexture({
      wood: WOOD_TEXTURE_URL,
      marble: MARBLE_TEXTURE_URL
  });

  // Prepare textures
  const woodTexture = useMemo(() => {
    const t = textures.wood.clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(0.5, 0.5);
    return t;
  }, [textures.wood]);

  const marbleTexture = useMemo(() => {
    const t = textures.marble.clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(1, 1);
    return t;
  }, [textures.marble]);

  // Define properties based on style
  const materialProps = useMemo(() => {
      switch (style) {
          case 'marble':
              return {
                  map: marbleTexture,
                  roughness: 0.2, // Polished marble
                  metalness: 0.1,
                  envMapIntensity: 0.8
              };
          case 'glass':
              return {
                  map: null, // No texture, pure material
                  roughness: 0.05, // Very smooth
                  metalness: 0.8, // Reflective
                  envMapIntensity: 2.0
              };
          case 'slate':
              return {
                  map: marbleTexture, // Use noise for concrete look
                  roughness: 0.9, // Matte
                  metalness: 0.0,
                  envMapIntensity: 0.3
              };
          case 'stone':
              return {
                  map: marbleTexture, // Re-use marble texture for stone grain
                  roughness: 0.95, // Very rough
                  metalness: 0.0,
                  envMapIntensity: 0.2
              };
          case 'wood':
          default:
              return {
                  // Apply wood texture to BOTH squares for a realistic wood board look
                  map: woodTexture, 
                  roughness: 0.6,
                  metalness: 0.0,
                  envMapIntensity: 0.5
              };
      }
  }, [style, isBlack, woodTexture, marbleTexture]);

  return (
    <meshStandardMaterial 
      color={color}
      {...materialProps}
    />
  );
};

const BoardBorder: React.FC<{ style: BoardStyle }> = ({ style }) => {
    const texture = useTexture(WOOD_TEXTURE_URL);
    const borderColor = getBorderColor(style);
    
    // Config texture specifically for border
    const borderMap = useMemo(() => {
      if (style === 'wood') {
          const t = texture.clone();
          t.wrapS = t.wrapT = RepeatWrapping;
          t.repeat.set(3, 3);
          return t;
      }
      return null;
    }, [texture, style]);
  
    return (
      <mesh position={[0, -0.2, 0]} receiveShadow>
         <boxGeometry args={[9.5, 0.3, 9.5]} />
         <meshStandardMaterial 
            map={borderMap} 
            color={borderColor} 
            roughness={style === 'glass' ? 0.2 : 0.8} 
            metalness={style === 'glass' ? 0.5 : 0.1} 
         />
      </mesh>
    );
};

// --- Individual Square Component ---
interface SquareProps {
  squareName: string;
  isBlack: boolean;
  position: [number, number, number];
  isValidMove: boolean;
  isLastMove: boolean;
  checkSquare: boolean;
  onSquareClick: (sq: string) => void;
  style: BoardStyle;
}

const Square: React.FC<SquareProps> = ({ squareName, isBlack, position, isValidMove, isLastMove, checkSquare, onSquareClick, style }) => {
  
  let color = getBoardColors(style, isBlack);
  if (checkSquare) color = "#ef5350"; // Red override for check

  return (
    <group position={position}>
      <mesh 
        onClick={(e) => { e.stopPropagation(); onSquareClick(squareName); }}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[1, 0.2, 1]} />
        <StyledSquareMaterial style={style} isBlack={isBlack} color={color} />
      </mesh>
      
      {/* Last Move Highlight Overlay */}
      {isLastMove && (
        <mesh position={[0, 0.105, 0]}>
           <boxGeometry args={[1, 0.01, 1]} />
           <meshBasicMaterial color="#fdd835" opacity={0.5} transparent />
        </mesh>
      )}

      {/* Valid Move Marker */}
      {isValidMove && (
        <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.18, 32]} />
            <meshBasicMaterial color="#66bb6a" opacity={0.8} transparent />
        </mesh>
      )}
    </group>
  );
};

export const Board: React.FC<BoardProps> = ({ onSquareClick, validMoves, lastMove, checkSquare, boardStyle }) => {
  const squares = [];
  const labels = [];
  const LABEL_Y = -0.04;
  const BORDER_OFFSET = 4.4;
  const labelColor = boardStyle === 'glass' ? '#94a3b8' : '#e6cca0';

  // Generate Squares
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isBlack = (r + c) % 2 === 1;
      const file = FILES[c];
      const rank = RANKS[r];
      const squareName = `${file}${rank}`;
      
      const x = c - 3.5;
      const z = -(r - 3.5);
      
      const isValidMove = validMoves.includes(squareName);
      const isLastMove = !!(lastMove && (lastMove.from === squareName || lastMove.to === squareName));
      const isCheck = checkSquare === squareName;

      squares.push(
        <Square 
          key={squareName}
          squareName={squareName}
          isBlack={isBlack}
          position={[x, 0, z]}
          isValidMove={isValidMove}
          isLastMove={isLastMove}
          checkSquare={isCheck}
          onSquareClick={onSquareClick}
          style={boardStyle}
        />
      );
    }
  }

  // Generate Border Labels
  FILES.forEach((file, i) => {
      const x = i - 3.5;
      labels.push(
          <Text key={`fb-${file}`} position={[x, LABEL_Y, BORDER_OFFSET]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.2} color={labelColor} anchorX="center" anchorY="middle">
              {file.toUpperCase()}
          </Text>,
          <Text key={`ft-${file}`} position={[x, LABEL_Y, -BORDER_OFFSET]} rotation={[-Math.PI/2, 0, Math.PI]} fontSize={0.2} color={labelColor} anchorX="center" anchorY="middle">
              {file.toUpperCase()}
          </Text>
      );
  });

  RANKS.forEach((rank, i) => {
      const z = -(i - 3.5);
      labels.push(
          <Text key={`rl-${rank}`} position={[-BORDER_OFFSET, LABEL_Y, z]} rotation={[-Math.PI/2, 0, Math.PI/2]} fontSize={0.2} color={labelColor} anchorX="center" anchorY="middle">
              {rank}
          </Text>,
          <Text key={`rr-${rank}`} position={[BORDER_OFFSET, LABEL_Y, z]} rotation={[-Math.PI/2, 0, -Math.PI/2]} fontSize={0.2} color={labelColor} anchorX="center" anchorY="middle">
              {rank}
          </Text>
      );
  });

  return (
    <group>
      <BoardBorder style={boardStyle} />
      {squares}
      {labels}
    </group>
  );
};