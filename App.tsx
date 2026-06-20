import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { GameScene } from './components/Chess3D/Scene';
import { getBestMove } from './services/geminiService';
import { RefreshCw, Cpu, User, RotateCcw, X, Info, Brain, Zap, Shield, Settings, Home, Play, Image as ImageIcon, Music, Volume2, VolumeX, SkipForward, Sliders, Cuboid, Grid3X3, Eye, EyeOff } from 'lucide-react';
import { Difficulty, PlayerColor, CapturedPiece, PieceSetType, BoardStyle } from './types';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

type AppState = 'splash' | 'playing';
type BgPreset = 'studio' | 'sunset' | 'forest' | 'city' | 'park' | 'lobby';

// Playlist Definitions
const MUSIC_TRACKS = [
    { name: 'גלקסיה (שקט)', src: 'https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/theme_01.mp3' },
    { name: 'זן דיגיטלי (רגוע)', src: 'https://codeskulptor-demos.commondatastorage.googleapis.com/pang/paza-moduless.mp3' },
    { name: 'רטרו אקשן (קצבי)', src: 'https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/race1.mp3' }
];

export default function App() {
  const [appState, setAppState] = useState<AppState>('splash');
  const [game, setGame] = useState(new Chess(INITIAL_FEN));
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [playerColor, setPlayerColor] = useState<PlayerColor>('w');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // --- UPDATED DEFAULTS ---
  const [bgPreset, setBgPreset] = useState<BgPreset>('forest');
  const [pieceSet, setPieceSet] = useState<PieceSetType>('wood');
  const [boardStyle, setBoardStyle] = useState<BoardStyle>('wood');
  const [showCapturedZones, setShowCapturedZones] = useState(false);
  
  // --- Audio State Defaults ---
  const [isMusicOn, setIsMusicOn] = useState(true);
  const [bgmVolume, setBgmVolume] = useState(0.1);
  const [sfxVolume, setSfxVolume] = useState(0.6);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMovesForSelected, setValidMovesForSelected] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{from: string, to: string} | undefined>(undefined);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  
  // State for animating captured pieces (visual effect only)
  const [recentCaptures, setRecentCaptures] = useState<CapturedPiece[]>([]);

  // State for PERMANENT captured pieces list (fixing the disappearance bug)
  // whiteCaptures = Black pieces captured BY White
  const [whiteCaptures, setWhiteCaptures] = useState<string[]>([]);
  // blackCaptures = White pieces captured BY Black
  const [blackCaptures, setBlackCaptures] = useState<string[]>([]);

  // Audio refs
  const audioRefs = useRef<{
      move: HTMLAudioElement;
      capture: HTMLAudioElement;
      check: HTMLAudioElement;
      bg: HTMLAudioElement;
  } | null>(null);

  const isGameOver = game.isGameOver();
  const turn = game.turn(); 

  const checkSquare = game.inCheck() ? game.board().flat().find(p => p && p.type === 'k' && p.color === turn)?.square : undefined;

  // Initialize Audio Objects
  useEffect(() => {
    // Create audio objects
    const move = new Audio('https://lichess1.org/assets/sound/standard/Move.mp3');
    const capture = new Audio('https://lichess1.org/assets/sound/standard/Capture.mp3');
    const check = new Audio('https://lichess1.org/assets/sound/standard/Check.mp3');
    const bg = new Audio(MUSIC_TRACKS[0].src);

    // Initial Volumes
    move.volume = sfxVolume;
    capture.volume = sfxVolume;
    check.volume = sfxVolume;
    
    // Config Background Music
    bg.loop = true;
    bg.volume = bgmVolume; 

    audioRefs.current = { move, capture, check, bg };
    
    return () => {
        if (bg) {
            bg.pause();
            bg.src = "";
        }
    };
  }, []);

  // Effect: Handle BGM Volume Changes
  useEffect(() => {
      if (audioRefs.current?.bg) {
          audioRefs.current.bg.volume = bgmVolume;
      }
  }, [bgmVolume]);

  // Effect: Handle SFX Volume Changes (Apply to next play)
  useEffect(() => {
      if (audioRefs.current) {
          audioRefs.current.move.volume = sfxVolume;
          audioRefs.current.capture.volume = sfxVolume;
          audioRefs.current.check.volume = sfxVolume;
      }
  }, [sfxVolume]);

  // Effect: Handle Track Switching
  useEffect(() => {
      if (audioRefs.current?.bg) {
          const wasPlaying = isMusicOn;
          // Change source
          audioRefs.current.bg.src = MUSIC_TRACKS[currentTrackIndex].src;
          
          // If it was playing (or set to play), try to resume
          if (wasPlaying) {
             const playPromise = audioRefs.current.bg.play();
             if (playPromise !== undefined) {
                 playPromise.catch(e => {
                     // Suppress 'NotAllowedError' which occurs on page load due to Autoplay Policy.
                     // The music will effectively start when the user clicks 'Start Game'.
                     if (e.name !== 'NotAllowedError') {
                         console.warn("Track play failed:", e);
                     }
                 });
             }
          }
      }
  }, [currentTrackIndex]);


  // Helper to safely play background music
  const playBackgroundMusic = () => {
      if (audioRefs.current?.bg) {
          const playPromise = audioRefs.current.bg.play();
          if (playPromise !== undefined) {
              playPromise
                .then(() => setIsMusicOn(true))
                .catch(e => {
                    // Suppress NotAllowedError if handled elsewhere, but log other errors
                    if (e.name !== 'NotAllowedError') {
                        console.error("Music play failed:", e);
                        setIsMusicOn(false); // Only revert state if it's a real error
                    } else {
                         // If blocked by browser, we keep isMusicOn=true, 
                         // so it plays on next interaction.
                    }
                });
          }
      }
  };

  // Helper to safely pause background music
  const pauseBackgroundMusic = () => {
      if (audioRefs.current?.bg) {
          audioRefs.current.bg.pause();
          setIsMusicOn(false);
      }
  };

  const nextTrack = () => {
      setCurrentTrackIndex((prev) => (prev + 1) % MUSIC_TRACKS.length);
  };

  useEffect(() => {
    if (aiMessage) {
      const timer = setTimeout(() => setAiMessage(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [aiMessage]);

  const playSound = (isCapture: boolean, isCheck: boolean) => {
    if (!audioRefs.current) return;

    let audio = audioRefs.current.move;
    if (isCheck) audio = audioRefs.current.check;
    else if (isCapture) audio = audioRefs.current.capture;
    
    // Ensure volume is current
    audio.volume = sfxVolume;
    audio.currentTime = 0;
    audio.play().catch(e => console.log("SFX play prevented:", e));
  };

  const handleCaptureLogic = (move: any) => {
    if (move.captured) {
      // 1. Trigger Animation
      const capturedPiece: CapturedPiece = {
        id: `${move.to}-${move.captured}-${Date.now()}`,
        type: move.captured,
        color: move.color === 'w' ? 'b' : 'w',
        square: move.to
      };
      
      setRecentCaptures(prev => [...prev, capturedPiece]);
      setTimeout(() => {
        setRecentCaptures(prev => prev.filter(p => p.id !== capturedPiece.id));
      }, 1000);

      // 2. Add to Permanent List (Fix for disappearing pieces)
      if (move.color === 'w') {
          // White made the move, so they captured a Black piece
          setWhiteCaptures(prev => [...prev, move.captured]);
      } else {
          // Black made the move, so they captured a White piece
          setBlackCaptures(prev => [...prev, move.captured]);
      }
    }
  };

  const makeMove = useCallback((from: string, to: string) => {
    try {
      const moves = game.moves({ verbose: true });
      const isLegal = moves.some(m => m.from === from && m.to === to);
      
      if (!isLegal) return false;

      const moveDetails = moves.find(m => m.from === from && m.to === to);
      const moveResult = game.move({ from, to, promotion: 'q' });
      
      if (moveResult) {
        if (moveDetails) handleCaptureLogic(moveResult);
        playSound(!!moveResult.captured, game.inCheck());

        setSelectedSquare(null);
        setValidMovesForSelected([]);

        // Create new game instance (NOTE: this clears internal history, hence the need for separate capture state)
        const newGame = new Chess(game.fen());
        setGame(newGame);
        setLastMove({ from, to });
        return true;
      }
    } catch (e) {
      console.error("Move error", e);
      return false;
    }
    return false;
  }, [game]);

  // AI Turn Logic
  useEffect(() => {
    if (appState === 'playing' && turn !== playerColor && !isGameOver) {
      const aiTurn = async () => {
        setIsAIThinking(true);
        await new Promise(r => setTimeout(r, 800));
        
        const uciMoves = game.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
        const aiResponse = await getBestMove(game.fen(), uciMoves, difficulty);
        setAiMessage(aiResponse.reasoning); 

        if (aiResponse.move) {
            let targetMove = aiResponse.move.trim().toLowerCase();
            if (!uciMoves.includes(targetMove)) {
                 const stripped = targetMove.replace(/[^a-z0-9]/g, '');
                 if (stripped.length === 5 && uciMoves.includes(stripped.substring(1))) {
                     targetMove = stripped.substring(1);
                 } else if (uciMoves.includes(stripped)) {
                     targetMove = stripped;
                 }
            }

            try {
                let moveResult = null;
                if (targetMove.length >= 4) {
                    const from = targetMove.substring(0, 2);
                    const to = targetMove.substring(2, 4);
                    const promotion = targetMove.length > 4 ? targetMove.substring(4, 5) : 'q';
                    try { moveResult = game.move({ from, to, promotion }); } catch (e) { /* ignore */ }
                }

                if (!moveResult) {
                     try { moveResult = game.move(targetMove); } catch (e) { /* ignore */ }
                }

                if (!moveResult) {
                    const randomMove = uciMoves[Math.floor(Math.random() * uciMoves.length)];
                    const rFrom = randomMove.substring(0, 2);
                    const rTo = randomMove.substring(2, 4);
                    const rProm = randomMove.length > 4 ? randomMove.substring(4, 5) : 'q';
                    moveResult = game.move({ from: rFrom, to: rTo, promotion: rProm });
                }

                if (moveResult) {
                    handleCaptureLogic(moveResult);
                    playSound(!!moveResult.captured, game.inCheck());
                    setGame(new Chess(game.fen()));
                    setLastMove({ from: moveResult.from, to: moveResult.to });
                }
            } catch (e) {
                console.error("Critical AI Move Error", e);
            }
        }
        setIsAIThinking(false);
      };
      aiTurn();
    }
  }, [game, turn, isGameOver, difficulty, appState, playerColor]);

  const handleSquareSelect = (square: string | null) => {
    if (turn !== playerColor || isGameOver) return;
    if (!square) {
      setSelectedSquare(null);
      setValidMovesForSelected([]);
      return;
    }
    const piece = game.get(square as any);
    if (piece && piece.color === turn) {
      setSelectedSquare(square);
      const moves = game.moves({ square: square as any, verbose: true });
      setValidMovesForSelected(moves.map(m => m.to));
    } else {
      setSelectedSquare(null);
      setValidMovesForSelected([]);
    }
  };

  const startGame = () => {
    setGame(new Chess(INITIAL_FEN));
    setLastMove(undefined);
    setAiMessage(null);
    setSelectedSquare(null);
    setValidMovesForSelected([]);
    setRecentCaptures([]);
    setWhiteCaptures([]); // Reset captures
    setBlackCaptures([]); // Reset captures
    setAppState('playing');
    
    // Logic to start music. Since this is a click handler, play() should succeed.
    if (isMusicOn) {
        playBackgroundMusic();
    }
  };

  const restartGame = () => {
    setGame(new Chess(INITIAL_FEN));
    setLastMove(undefined);
    setAiMessage(null);
    setSelectedSquare(null);
    setValidMovesForSelected([]);
    setRecentCaptures([]);
    setWhiteCaptures([]); // Reset captures
    setBlackCaptures([]); // Reset captures
    setShowSettingsModal(false);
  };

  const quitToMenu = () => {
      setAppState('splash');
      setShowSettingsModal(false);
  };

  const toggleMusic = () => {
      if (isMusicOn) {
          pauseBackgroundMusic();
      } else {
          playBackgroundMusic();
      }
  };

  const getDifficultyLabel = (d: Difficulty) => {
      switch(d) {
          case 'Easy': return 'קל';
          case 'Medium': return 'בינוני';
          case 'Hard': return 'קשה';
      }
  };

  const bgOptions: { id: BgPreset, label: string, color: string }[] = [
    { id: 'studio', label: 'סטודיו כהה', color: 'bg-slate-800' },
    { id: 'sunset', label: 'שקיעה', color: 'bg-orange-500' },
    { id: 'forest', label: 'יער', color: 'bg-green-700' },
    { id: 'city', label: 'עיר', color: 'bg-blue-600' },
    { id: 'park', label: 'פארק', color: 'bg-green-500' },
    { id: 'lobby', label: 'לובי', color: 'bg-amber-700' },
  ];

  const pieceSetOptions: { id: PieceSetType, label: string, desc: string }[] = [
      { id: 'standard', label: 'קלאסי (מתכת)', desc: 'זהב וכסף מבריקים' },
      { id: 'wood', label: 'עץ מסורתי', desc: 'מייפל ואגוז בגימור מט' },
      { id: 'plastic', label: 'מודרני (פלסטיק)', desc: 'שחור ולבן נקיים' },
      { id: 'stone', label: 'אבן עתיקה', desc: 'גרניט וצפחה מחוספסים' },
  ];

  const boardStyleOptions: { id: BoardStyle, label: string, desc: string }[] = [
      { id: 'wood', label: 'עץ מהגוני', desc: 'קלאסי וחמים' },
      { id: 'marble', label: 'שיש ירוק', desc: 'טורניר יוקרתי' },
      { id: 'glass', label: 'זכוכית כהה', desc: 'מינימליסטי' },
      { id: 'slate', label: 'בטון', desc: 'תעשייתי ומחוספס' },
      { id: 'stone', label: 'אבן ירושלמית', desc: 'גווני זהב ואדמה' },
  ];

  // --- RENDER SPLASH SCREEN ---
  if (appState === 'splash') {
      return (
        <div 
            className="w-full h-screen relative overflow-hidden font-sans flex flex-col items-center justify-center text-white"
            style={{
                background: 'radial-gradient(circle at center, #1a233a 0%, #050505 100%)'
            }}
        >
            <div className="z-10 text-center max-w-md w-full px-6 animate-in fade-in zoom-in duration-500">
                <div className="mb-8 flex justify-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20">
                        <Brain size={48} className="text-white" />
                    </div>
                </div>
                
                <h1 className="text-5xl font-black tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Gemini Chess
                </h1>
                <p className="text-slate-400 mb-8 text-lg">שחמט תלת-ממדי מול בינה מלאכותית</p>

                <div className="space-y-6 mb-10">
                    {/* Difficulty Selection */}
                    <div>
                        <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-3">רמת קושי</p>
                        <div className="grid grid-cols-3 gap-3">
                            {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((level) => (
                                <button
                                    key={level}
                                    onClick={() => setDifficulty(level)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                                        difficulty === level 
                                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-600'
                                    }`}
                                >
                                    {level === 'Easy' && <Zap size={20} className="mb-1" />}
                                    {level === 'Medium' && <Shield size={20} className="mb-1" />}
                                    {level === 'Hard' && <Brain size={20} className="mb-1" />}
                                    <span className="text-sm font-bold">{getDifficultyLabel(level)}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Color Selection */}
                    <div>
                        <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-3">בחר צבע</p>
                        <div className="grid grid-cols-2 gap-3">
                             <button
                                onClick={() => setPlayerColor('w')}
                                className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all ${
                                    playerColor === 'w' 
                                    ? 'bg-slate-200 text-slate-900 border-white shadow-lg' 
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                                }`}
                             >
                                <div className="w-4 h-4 rounded-full bg-slate-200 border border-slate-400"></div>
                                <span className="font-bold">לבן (מתחיל)</span>
                             </button>

                             <button
                                onClick={() => setPlayerColor('b')}
                                className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all ${
                                    playerColor === 'b' 
                                    ? 'bg-slate-900 text-white border-slate-500 shadow-lg shadow-black/50' 
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                                }`}
                             >
                                <div className="w-4 h-4 rounded-full bg-slate-900 border border-slate-600"></div>
                                <span className="font-bold">שחור (שני)</span>
                             </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                     <button 
                        onClick={toggleMusic}
                        className={`p-4 rounded-2xl transition-all border ${
                            isMusicOn 
                            ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' 
                            : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800'
                        }`}
                        title={isMusicOn ? "כבה מוסיקה" : "הפעל מוסיקה"}
                    >
                        {isMusicOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
                    </button>
                    
                    <button 
                        onClick={startGame}
                        className="flex-1 bg-white text-slate-900 font-black text-xl py-4 rounded-2xl hover:scale-105 transition-transform shadow-xl shadow-white/10 flex items-center justify-center gap-2"
                    >
                        <Play fill="currentColor" />
                        התחל משחק
                    </button>
                </div>
            </div>

            {/* Background Decor */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                 <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500 blur-[120px] rounded-full mix-blend-screen" />
                 <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500 blur-[120px] rounded-full mix-blend-screen" />
            </div>
        </div>
      );
  }

  // --- RENDER GAME ---
  const isPlayerTurn = turn === playerColor;

  return (
    <div 
      className="w-full h-screen relative overflow-hidden font-sans"
      style={{
        background: 'radial-gradient(circle at center, #1a233a 0%, #050505 100%)'
      }}
    >
      
      {/* 3D Game Area */}
      <div className="absolute inset-0 z-0">
        <GameScene 
          fen={game.fen()} 
          onMove={makeMove}
          selectedSquare={selectedSquare}
          onSelectSquare={handleSquareSelect}
          validMoves={validMovesForSelected}
          lastMove={lastMove}
          turn={turn}
          checkSquare={checkSquare}
          playerColor={playerColor}
          bgPreset={bgPreset}
          recentCaptures={recentCaptures}
          pieceSet={pieceSet}
          boardStyle={boardStyle}
          capturedByWhite={whiteCaptures}
          capturedByBlack={blackCaptures}
          showCapturedZones={showCapturedZones}
        />
      </div>

      {/* --- UI OVERLAY --- */}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none flex justify-center z-10">
        <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 text-white px-6 py-2 rounded-full shadow-lg font-bold text-sm flex items-center gap-3">
            <span className={`flex items-center gap-2 ${isPlayerTurn ? 'text-green-400' : 'text-slate-500'}`}>
                <User size={16} /> שחקן ({playerColor === 'w' ? 'לבן' : 'שחור'})
            </span>
            <span className="text-white/20">|</span>
            <span className={`flex items-center gap-2 ${!isPlayerTurn ? 'text-yellow-500' : 'text-slate-500'}`}>
                {isAIThinking ? <RefreshCw size={16} className="animate-spin" /> : <Cpu size={16} />}
                Gemini ({getDifficultyLabel(difficulty)})
            </span>
        </div>
      </div>
      
      {/* Settings & Toggle Buttons (Top Left) */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="p-3 bg-slate-900/50 backdrop-blur-md text-white rounded-full hover:bg-slate-800 border border-white/10 transition-colors"
          >
              <Settings size={24} />
          </button>
          
          <button 
            onClick={() => setShowCapturedZones(!showCapturedZones)}
            className="p-3 bg-slate-900/50 backdrop-blur-md text-white rounded-full hover:bg-slate-800 border border-white/10 transition-colors"
            title={showCapturedZones ? "הסתר כלים שנאכלו" : "הצג כלים שנאכלו"}
          >
              {showCapturedZones ? <Eye size={24} /> : <EyeOff size={24} />}
          </button>
      </div>

      {/* Music Toggle (Top Right) */}
      <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={toggleMusic}
            className={`p-3 backdrop-blur-md rounded-full border transition-colors ${
                isMusicOn 
                ? 'bg-blue-600/30 text-blue-400 border-blue-500/30 hover:bg-blue-600/50' 
                : 'bg-slate-900/50 text-slate-400 border-white/10 hover:bg-slate-800'
            }`}
          >
              {isMusicOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
      </div>

      {/* AI Insight Toast */}
      {aiMessage && (
        <div className="absolute top-20 left-4 right-4 z-10 flex justify-center animate-in slide-in-from-top-2 fade-in duration-300 pointer-events-none">
           <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl text-white p-4 rounded-xl shadow-2xl border border-slate-700 max-w-md w-full relative">
              <button onClick={() => setAiMessage(null)} className="absolute top-2 right-2 text-slate-400 hover:text-white">
                 <X size={16} />
              </button>
              <div className="flex gap-3">
                 <Info className="text-blue-400 shrink-0 mt-0.5" size={20} />
                 <div className="text-right w-full" dir="rtl">
                    <p className="text-sm leading-relaxed text-slate-200">{aiMessage}</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
             <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl text-center max-w-md w-full mx-4 text-white overflow-y-auto max-h-[90vh]">
                <h2 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2">
                    <Settings /> הגדרות
                </h2>
                
                {/* Audio Settings Container */}
                 <div className="mb-6 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-4 flex items-center justify-center gap-2">
                         <Music size={16} /> שמע ומוסיקה
                    </p>
                    
                    {/* Master Toggle */}
                    <button
                        onClick={toggleMusic}
                        className={`w-full p-3 mb-4 rounded-xl border flex items-center justify-center gap-3 transition-all ${
                            isMusicOn 
                            ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        {isMusicOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                        <span className="font-bold">{isMusicOn ? 'השמע פעיל' : 'השמע כבוי'}</span>
                    </button>

                    <div className="space-y-4">
                        {/* BGM Volume */}
                        <div className="flex flex-col gap-2">
                             <div className="flex justify-between text-xs text-slate-400">
                                 <span>מוסיקת רקע</span>
                                 <span>{Math.round(bgmVolume * 100)}%</span>
                             </div>
                             <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.05"
                                value={bgmVolume}
                                onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                                className="w-full accent-blue-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                             />
                        </div>

                         {/* SFX Volume */}
                         <div className="flex flex-col gap-2">
                             <div className="flex justify-between text-xs text-slate-400">
                                 <span>אפקטים (SFX)</span>
                                 <span>{Math.round(sfxVolume * 100)}%</span>
                             </div>
                             <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.05"
                                value={sfxVolume}
                                onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                                className="w-full accent-green-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                             />
                        </div>

                        {/* Track Select */}
                         <div className="pt-2 border-t border-slate-700 mt-2">
                             <div className="flex items-center justify-between bg-slate-900 rounded-lg p-2 border border-slate-700">
                                <div className="text-left overflow-hidden">
                                    <span className="text-xs text-slate-500 block">מתנגן כעת:</span>
                                    <span className="text-sm font-bold text-white whitespace-nowrap">{MUSIC_TRACKS[currentTrackIndex].name}</span>
                                </div>
                                <button 
                                    onClick={nextTrack}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"
                                    title="החלף מנגינה"
                                >
                                    <SkipForward size={20} />
                                </button>
                             </div>
                         </div>
                    </div>
                </div>

                {/* Piece Set Selection */}
                <div className="mb-6">
                    <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-3 flex items-center justify-center gap-2">
                         <Cuboid size={16} /> סגנון כלים
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {pieceSetOptions.map(option => (
                            <button
                                key={option.id}
                                onClick={() => setPieceSet(option.id)}
                                className={`p-3 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                                    pieceSet === option.id 
                                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg' 
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                                }`}
                            >
                                <span className="font-bold">{option.label}</span>
                                <span className="text-xs opacity-70">{option.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Board Style Selection */}
                <div className="mb-6">
                    <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-3 flex items-center justify-center gap-2">
                         <Grid3X3 size={16} /> סגנון לוח
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {boardStyleOptions.map(option => (
                            <button
                                key={option.id}
                                onClick={() => setBoardStyle(option.id)}
                                className={`p-3 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                                    boardStyle === option.id 
                                    ? 'bg-green-600/20 border-green-500 text-white shadow-lg' 
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                                }`}
                            >
                                <span className="font-bold">{option.label}</span>
                                <span className="text-xs opacity-70">{option.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Background Selection in Modal */}
                <div className="mb-6">
                    <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-3 flex items-center justify-center gap-2">
                         <ImageIcon size={16} /> רקע (Skybox)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {bgOptions.map(option => (
                            <button
                                key={option.id}
                                onClick={() => setBgPreset(option.id)}
                                className={`p-2 rounded-lg border text-sm font-medium transition-all relative overflow-hidden ${
                                    bgPreset === option.id 
                                    ? 'border-white text-white shadow-lg scale-105' 
                                    : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                                }`}
                            >
                                <div className={`absolute inset-0 opacity-20 ${option.color}`}></div>
                                <span className="relative z-10">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3 border-t border-slate-700 pt-6">
                    <button 
                        onClick={() => setShowSettingsModal(false)}
                        className="w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-colors"
                    >
                        חזור למשחק
                    </button>
                    
                    <button 
                        onClick={restartGame}
                        className="w-full py-4 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={18} /> משחק חדש
                    </button>

                    <button 
                        onClick={quitToMenu}
                        className="w-full py-4 bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/30 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        <Home size={18} /> תפריט ראשי
                    </button>
                </div>
             </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {isGameOver && !showSettingsModal && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center">
             <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl text-center max-w-xs mx-4 text-white">
                <div className="text-4xl mb-4">
                    {game.isCheckmate() ? (turn === playerColor ? '💀' : '🏆') : '🤝'}
                </div>
                <h2 className="text-2xl font-bold mb-2">
                    {game.isCheckmate() ? (turn === playerColor ? 'הפסד' : 'ניצחון!') : 'תיקו'}
                </h2>
                <p className="text-slate-400 mb-6">
                    {game.isCheckmate() ? (turn === playerColor ? 'Gemini ניצח במשחק.' : 'כל הכבוד, ניצחת את Gemini!') : 'המשחק הסתיים ללא הכרעה.'}
                </p>
                <div className="flex flex-col gap-3">
                    <button onClick={restartGame} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/30">
                        משחק חדש
                    </button>
                    <button onClick={quitToMenu} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors">
                        תפריט ראשי
                    </button>
                </div>
             </div>
          </div>
      )}

    </div>
  );
}