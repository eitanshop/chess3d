import React, { useMemo, Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Text } from '@react-three/drei';
import { Board } from './Board';
import * as Pieces from './Pieces';
import { Chess } from 'chess.js';
import { PlayerColor, CapturedPiece, PieceSetType, BoardStyle } from '../../types';
import * as THREE from 'three';

interface SceneProps {
  fen: string;
  onMove: (from: string, to: string) => void;
  validMoves: string[]; 
  selectedSquare: string | null;
  onSelectSquare: (square: string | null) => void;
  lastMove?: { from: string, to: string };
  turn: 'w' | 'b';
  checkSquare?: string;
  playerColor: PlayerColor;
  bgPreset: string;
  recentCaptures?: CapturedPiece[];
  pieceSet: PieceSetType;
  boardStyle: BoardStyle;
  capturedByWhite: string[]; // Black pieces captured by White
  capturedByBlack: string[]; // White pieces captured by Black
  showCapturedZones: boolean;
}

// Helper to convert board coordinates (e.g. "e4") to 3D world coordinates
const getSquarePosition = (square: string): [number, number, number] => {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0-7
    const rank = parseInt(square[1]) - 1; // 0-7
    
    const x = file - 3.5;
    const z = - (rank - 3.5);
    return [x, 0, z];
};

const CapturedZone: React.FC<{ 
    pieces: string[], 
    color: 'w' | 'b', 
    position: [number, number, number], 
    rotation?: [number, number, number],
    pieceSet: PieceSetType 
}> = ({ pieces, color, position, rotation = [0, 0, 0], pieceSet }) => {
    // Sort pieces by value: Queen > Rook > Bishop > Knight > Pawn
    const sortOrder: Record<string, number> = { q: 5, r: 4, b: 3, n: 2, p: 1 };
    const sortedPieces = useMemo(() => {
        return [...pieces].sort((a, b) => (sortOrder[b] || 0) - (sortOrder[a] || 0));
    }, [pieces]);

    // Render base even if empty so user sees the zone
    return (
        <group position={position} rotation={rotation}>
            {/* Base Plate for captured pieces */}
            <mesh position={[0, -0.1, 0]} receiveShadow>
                <boxGeometry args={[2.2, 0.2, 7.5]} />
                <meshStandardMaterial color="#0f0f0f" transparent opacity={0.4} roughness={0.8} />
                <lineSegments>
                     <edgesGeometry args={[new THREE.BoxGeometry(2.2, 0.2, 7.5)] as any} />
                     <lineBasicMaterial color="#ffffff" opacity={0.1} transparent />
                </lineSegments>
            </mesh>

            {sortedPieces.map((type, i) => {
                 const PieceComponent = {
                    'p': Pieces.Pawn,
                    'r': Pieces.Rook,
                    'n': Pieces.Knight,
                    'b': Pieces.Bishop,
                    'q': Pieces.Queen,
                    'k': Pieces.King
                  }[type];
                  
                  if (!PieceComponent) return null;

                  // Layout: 2 Columns zigzag
                  const col = i % 2; 
                  const row = Math.floor(i / 2);
                  
                  // Start from "back" to "front" or vice versa
                  const z = (row - 3.5) * 0.9;
                  const x = (col - 0.5) * 1.0;

                  return (
                      <group key={`cap-${i}-${pieceSet}`} position={[x, 0, z]} scale={0.65}>
                          <PieceComponent 
                            position={[0,0,0]} 
                            color={color} 
                            pieceSet={pieceSet} 
                          />
                      </group>
                  );
            })}
        </group>
    );
};

export const GameScene: React.FC<SceneProps> = ({ 
  fen, 
  onMove, 
  validMoves, 
  selectedSquare, 
  onSelectSquare,
  lastMove, 
  turn,
  checkSquare,
  playerColor,
  bgPreset,
  recentCaptures = [],
  pieceSet,
  boardStyle,
  capturedByWhite,
  capturedByBlack,
  showCapturedZones
}) => {
  const game = useMemo(() => new Chess(fen), [fen]);
  const board = game.board();
  
  // Responsive State
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 1000);
      checkMobile(); // Initial check
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Determine camera position based on player color
  // Mobile needs to be further back/up to fit the captured zones + UI overlays
  const cameraPosition: [number, number, number] = useMemo(() => {
      if (isMobile) {
          // Increased Z distance for mobile to see top/bottom zones clearly
          return playerColor === 'w' ? [0, 24, 20] : [0, 24, -20];
      }
      return playerColor === 'w' ? [0, 15, 13] : [0, 15, -13];
  }, [isMobile, playerColor]);

  const handleSquareClick = (square: string) => {
    if (selectedSquare) {
      if (validMoves.includes(square)) {
        onMove(selectedSquare, square);
        onSelectSquare(null); 
      } else {
        onSelectSquare(square);
      }
    } else {
      onSelectSquare(square);
    }
  };

  // Render Active Pieces
  const pieceComponents = [];
  
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const file = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][c];
        const rank = ['8', '7', '6', '5', '4', '3', '2', '1'][r]; 
        const squareName = `${file}${rank}`;
        
        const position = getSquarePosition(squareName);
        
        const isSelected = selectedSquare === squareName;
        
        // --- ANIMATION LOGIC ---
        let startPosition: [number, number, number] | undefined = undefined;
        if (lastMove && lastMove.to === squareName) {
            startPosition = getSquarePosition(lastMove.from);
        }

        const PieceComponent = {
          'p': Pieces.Pawn,
          'r': Pieces.Rook,
          'n': Pieces.Knight,
          'b': Pieces.Bishop,
          'q': Pieces.Queen,
          'k': Pieces.King
        }[piece.type];

        if (PieceComponent) {
          pieceComponents.push(
            <PieceComponent
              // KEY CHANGE: Adding pieceSet to the key forces a full re-mount 
              // of the component when the set changes, fixing the texture persistence bug.
              key={`piece-${squareName}-${piece.type}-${piece.color}-${pieceSet}`}
              position={position}
              startPosition={startPosition}
              color={piece.color}
              isSelected={isSelected}
              onClick={() => handleSquareClick(squareName)}
              pieceSet={pieceSet}
            />
          );
        }
      }
    }
  }

  // Render Captured Pieces (Animation Ghosts for "dying" effect)
  const capturedAnimationComponents = recentCaptures.map((cap) => {
     const PieceComponent = {
        'p': Pieces.Pawn,
        'r': Pieces.Rook,
        'n': Pieces.Knight,
        'b': Pieces.Bishop,
        'q': Pieces.Queen,
        'k': Pieces.King
      }[cap.type];

      if (!PieceComponent) return null;

      const position = getSquarePosition(cap.square);

      return (
        <PieceComponent 
            key={cap.id}
            position={position}
            color={cap.color}
            isCaptured={true}
            pieceSet={pieceSet}
        />
      );
  });

  const isStudio = bgPreset === 'studio';

  // --- Captured Zones Positions ---
  // If mobile, place at Top/Bottom (Z axis). If Desktop, place at Left/Right (X axis).
  
  // Z=6.5 provides safe clearance from board border (4.75)
  const whiteZonePos: [number, number, number] = isMobile ? [0, 0, 6.5] : [-6.5, 0, 0];
  const whiteZoneRot: [number, number, number] = isMobile ? [0, Math.PI / 2, 0] : [0, 0, 0];
  
  const blackZonePos: [number, number, number] = isMobile ? [0, 0, -6.5] : [6.5, 0, 0];
  const blackZoneRot: [number, number, number] = isMobile ? [0, Math.PI / 2, 0] : [0, 0, 0];

  return (
    <Canvas shadows camera={{ position: cameraPosition, fov: 45 }} gl={{ alpha: true }}>
      
      <OrbitControls 
        minPolarAngle={0} 
        maxPolarAngle={Math.PI / 2.2} 
        enablePan={false}
        minDistance={5}
        maxDistance={35} 
      />
      
      {/* Lights */}
      <ambientLight intensity={isStudio ? 0.5 : 0.3} />
      <spotLight 
        position={[10, 15, 10]} 
        angle={0.5} 
        penumbra={1} 
        intensity={2} 
        castShadow 
        shadow-bias={-0.0001} 
      />
      <pointLight position={[-10, 5, -10]} intensity={1} color="#4fa3ff" />
      <pointLight position={[10, 5, -10]} intensity={1} color="#ffeb3b" />
      
      {/* Environment / Skybox */}
      <Suspense fallback={null}>
        {isStudio ? (
          <Environment preset="city" />
        ) : (
          <Environment preset={bgPreset as any} background />
        )}
        
        <group>
          <Board 
            onSquareClick={handleSquareClick} 
            validMoves={validMoves}
            lastMove={lastMove}
            checkSquare={checkSquare}
            boardStyle={boardStyle}
          />
          {pieceComponents}
          {capturedAnimationComponents}

          {/* Captured Zones */}
          {showCapturedZones && (
            <>
                {/* 
                   White's Loot (Black Pieces).
                   Desktop: Left Side.
                   Mobile: Bottom Side (Player side if White).
                */}
                <CapturedZone 
                   pieces={capturedByWhite} 
                   color="b" 
                   position={whiteZonePos}
                   rotation={whiteZoneRot} 
                   pieceSet={pieceSet}
                />
                
                {/* 
                   Black's Loot (White Pieces).
                   Desktop: Right Side.
                   Mobile: Top Side (Opponent side if White).
                */}
                <CapturedZone 
                   pieces={capturedByBlack} 
                   color="w" 
                   position={blackZonePos}
                   rotation={blackZoneRot}
                   pieceSet={pieceSet}
                />
            </>
          )}

        </group>
      </Suspense>
    </Canvas>
  );
};