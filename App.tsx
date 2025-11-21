import React, { useState, useRef, useEffect } from 'react';
import GameCanvas, { GameEngine } from './components/GameCanvas';
import Overlay from './components/Overlay';
import { GameState, GameMode, HighScore } from './types';
import { COLORS, AVAILABLE_COLORS, WIN_PIXELS, HIGH_SCORE_KEY } from './constants';

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [gameMode, setGameMode] = useState<GameMode>('STANDARD');
  const [score, setScore] = useState(0);
  const [penaltyCount, setPenaltyCount] = useState(0);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [targetColor, setTargetColor] = useState(COLORS.RED);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  
  // We keep a ref to the engine to call methods directly (like start game)
  const gameEngineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(HIGH_SCORE_KEY);
    if (stored) {
      try {
        setHighScores(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse high scores", e);
      }
    }
  }, []);

  const saveHighScore = (name: string) => {
    const newScore: HighScore = {
      name: name.trim() || 'Anonymous',
      score: finalScore,
      mode: gameMode,
      date: Date.now()
    };
    
    const updatedScores = [...highScores, newScore]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Keep top 10
      
    setHighScores(updatedScores);
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(updatedScores));
  };

  const startGame = (mode: GameMode) => {
    const randomColor = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];
    setTargetColor(randomColor);
    setGameMode(mode);
    setScore(0);
    setPenaltyCount(0);
    setFinalScore(0);
    setGameState(GameState.PLAYING);
    gameEngineRef.current?.start(randomColor, mode);
  };
  
  const restartGame = () => {
      startGame(gameMode);
  };

  const goToMenu = () => {
    if (gameEngineRef.current) {
       gameEngineRef.current.stopAudio();
    }
    setGameState(GameState.START);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans">
       <GameCanvas 
         gameState={gameState}
         setGameState={setGameState}
         targetColor={targetColor}
         setTargetColor={setTargetColor}
         score={score}
         setScore={setScore}
         setPenaltyCount={setPenaltyCount}
         setFinalScore={setFinalScore}
         gameRef={gameEngineRef}
         gameMode={gameMode}
       />
       
       <Overlay 
         gameState={gameState} 
         targetColor={targetColor} 
         onStart={startGame}
         onRestart={restartGame}
         onMainMenu={goToMenu}
         score={score}
         winScore={WIN_PIXELS}
         gameMode={gameMode}
         penaltyCount={penaltyCount}
         finalScore={finalScore}
         highScores={highScores}
         onSaveScore={saveHighScore}
       />
       
       <div className="absolute bottom-4 text-slate-500 text-xs text-center">
          <p>JKL Cut - A Premiere Pro training tool</p>
       </div>
    </div>
  );
}

export default App;