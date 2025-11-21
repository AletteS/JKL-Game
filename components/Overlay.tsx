import React, { useState } from 'react';
import { GameState, GameMode, HighScore } from '../types';
import { RotateCcw, Award, AlertTriangle, Info, Scissors, Cat, Menu, Save, Trophy, X } from 'lucide-react';
import { BAD_HABIT_THRESHOLD } from '../constants';

interface OverlayProps {
  gameState: GameState;
  targetColor: string;
  onStart: (mode: GameMode) => void;
  onRestart: () => void;
  onMainMenu: () => void;
  score: number;
  winScore: number;
  gameMode?: GameMode;
  penaltyCount: number;
  finalScore: number;
  highScores: HighScore[];
  onSaveScore: (name: string) => void;
}

const Overlay: React.FC<OverlayProps> = ({ 
    gameState, targetColor, onStart, onRestart, onMainMenu, score, winScore, gameMode, penaltyCount, finalScore, highScores, onSaveScore 
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('STANDARD');
  const [playerName, setPlayerName] = useState('');
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  const handleSubmitScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (scoreSubmitted) return;
    onSaveScore(playerName);
    setScoreSubmitted(true);
  };

  const isCatMode = gameMode === 'CAT_MODE';

  if (gameState === GameState.PLAYING) {
    return (
      <div className="absolute top-4 left-4 p-4 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg text-white shadow-xl select-none z-10 max-w-xs">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-bold text-lg">Target:</span>
          {gameMode === 'CAT_MODE' ? (
              <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center overflow-hidden relative shadow-sm">
                  {/* Changed ears to orange-500 to show up on slate-200 background */}
                  <div className="absolute top-2 left-1.5 w-1 h-1 bg-orange-500 rounded-full"></div>
                  <div className="absolute top-2 right-1.5 w-1 h-1 bg-orange-500 rounded-full"></div>
                  <div className="absolute bottom-1.5 w-2 h-3 bg-pink-400 rounded-full animate-pulse"></div>
              </div>
          ) : (
            <div className="w-8 h-8 rounded flex items-center justify-center shadow-sm ring-2 ring-white/20" style={{ backgroundColor: targetColor }}>
                <div className="w-full h-full rounded bg-gradient-to-br from-white/20 to-transparent"></div>
            </div>
          )}
          <span className="text-xs text-slate-400 ml-auto uppercase tracking-widest font-semibold">{gameMode === 'CAT_MODE' ? 'Meow' : 'Color'}</span>
          
          {/* Exit Button */}
          <button 
            onClick={onMainMenu}
            className="ml-auto p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors pointer-events-auto"
            title="Exit to Menu"
          >
             <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-sm font-mono text-slate-300 mb-1">
          Progress:
        </div>
        <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden mb-2 border border-slate-600">
             <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${Math.min((score / winScore) * 100, 100)}%` }}></div>
        </div>
        
        <div className="flex justify-between items-center border-t border-slate-700 pt-2 mb-2">
            <span className="text-xs text-slate-400">Bad Habits:</span>
            <span className={`text-xs font-bold ${penaltyCount > BAD_HABIT_THRESHOLD ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
                {penaltyCount}
            </span>
        </div>

        <div className="text-xs text-slate-400 border-t border-slate-700 pt-2 space-y-2">
            <div className="grid grid-cols-3 gap-1 text-center">
                <div><kbd className="bg-slate-700 text-white px-1 rounded">J</kbd> <br/><span className="text-[10px]">Rev</span></div>
                <div><kbd className="bg-slate-700 text-white px-1 rounded">K</kbd> <br/><span className="text-[10px]">Stop</span></div>
                <div><kbd className="bg-slate-700 text-white px-1 rounded">L</kbd> <br/><span className="text-[10px]">Fwd</span></div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center pt-1">
                <div><kbd className="bg-slate-700 text-white px-1 rounded">I</kbd> <br/><span className="text-[10px]">In</span></div>
                <div><kbd className="bg-slate-700 text-white px-1 rounded">O</kbd> <br/><span className="text-[10px]">Out</span></div>
                <div><kbd className="bg-slate-700 text-white px-1 rounded">.</kbd> <br/><span className="text-[10px]">Extract</span></div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
      <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-lg w-full text-center">
        {gameState === GameState.START && (
          <>
            <div className="w-16 h-16 bg-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-600/20 rotate-3">
              {selectedMode === 'CAT_MODE' ? <Cat className="w-8 h-8 text-white ml-1" /> : <Scissors className="w-8 h-8 text-white ml-1" />}
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">JKL Cut</h1>
            <p className="text-slate-400 mb-6">
              Assemble the perfect sequence.
            </p>
            
            <div className="flex justify-center gap-4 mb-6">
                <button 
                    onClick={() => setSelectedMode('STANDARD')}
                    className={`px-4 py-2 rounded-lg border transition-all flex flex-col items-center w-32 ${selectedMode === 'STANDARD' ? 'bg-purple-600/20 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-800/80'}`}
                >
                    <Scissors className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold">Standard</span>
                </button>
                <button 
                    onClick={() => setSelectedMode('CAT_MODE')}
                    className={`px-4 py-2 rounded-lg border transition-all flex flex-col items-center w-32 ${selectedMode === 'CAT_MODE' ? 'bg-purple-600/20 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-800/80'}`}
                >
                    <Cat className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold">Cat Mode</span>
                </button>
            </div>

            {highScores.length > 0 && (
               <div className="mb-6 text-left bg-slate-800/50 p-4 rounded border border-slate-700 max-h-32 overflow-y-auto">
                 <div className="flex items-center gap-2 mb-2 text-yellow-400 font-bold text-xs uppercase tracking-wider">
                    <Trophy className="w-3 h-3" /> Leaderboard
                 </div>
                 <table className="w-full text-xs">
                   <tbody>
                     {highScores.slice(0, 3).map((hs, i) => (
                       <tr key={i} className="text-slate-300">
                         <td className="w-6 text-slate-500">#{i+1}</td>
                         <td className="font-medium">{hs.name}</td>
                         <td className="text-right text-slate-400">{hs.score}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            )}

            <div className="bg-slate-800/60 p-5 rounded-lg text-left text-sm text-slate-300 mb-8 space-y-3 border border-slate-700">
              <div className="flex gap-2 items-start">
                 <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                 {selectedMode === 'CAT_MODE' ? (
                     <p>Mark In <strong className="text-white">(I)</strong> and Out <strong className="text-white">(O)</strong> to capture the <strong className="text-pink-400">ENTIRE</strong> Meow. You can include up to 10 frames of silence.</p>
                 ) : (
                     <p>Mark In <strong className="text-white">(I)</strong> and Out <strong className="text-white">(O)</strong> to select clips matching your target color.</p>
                 )}
              </div>
              
              <div className="mt-4 bg-slate-900/50 p-3 rounded border border-slate-700">
                  <strong className="text-white block mb-2 text-xs uppercase tracking-wider">Pro Tips</strong>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-400">
                    <li>Hold <kbd className="bg-slate-700 text-white px-1 rounded">K</kbd> and tap <kbd className="bg-slate-700 text-white px-1 rounded">L</kbd> to step forward.</li>
                    <li>Hold <kbd className="bg-slate-700 text-white px-1 rounded">K</kbd> and hold <kbd className="bg-slate-700 text-white px-1 rounded">L</kbd> for slow-mo.</li>
                    <li>Don't peck at the keys! Smooth shuttling yields high scores.</li>
                  </ul>
              </div>
            </div>

            <button
              onClick={() => onStart(selectedMode)}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-purple-900/50"
            >
              Start Editing
            </button>
          </>
        )}

        {gameState === GameState.WON && (
          <>
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/50 animate-bounce">
              <Award className="w-8 h-8 text-white" />
            </div>
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-2">Picture Lock!</h2>
                <div className="flex items-center justify-center gap-2 text-6xl font-black text-yellow-400 drop-shadow-lg mt-4">
                    {finalScore}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                    (Based on speed & efficiency)
                </div>
            </div>

            {!scoreSubmitted ? (
              <form onSubmit={handleSubmitScore} className="mb-6 animate-fade-in">
                  <p className="text-sm text-slate-300 mb-2">Enter your name for the records:</p>
                  <div className="flex gap-2 justify-center">
                      <input 
                        type="text" 
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        maxLength={12}
                        placeholder="Editor Name"
                        className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500 w-40"
                        autoFocus
                      />
                      <button 
                        type="submit"
                        disabled={!playerName.trim()}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded px-3 py-2"
                      >
                          <Save className="w-4 h-4" />
                      </button>
                  </div>
              </form>
            ) : (
                <div className="mb-6 bg-slate-800/80 rounded-lg p-4 border border-slate-700 max-h-48 overflow-y-auto">
                     <div className="flex items-center justify-center gap-2 mb-3 text-yellow-400 font-bold text-sm uppercase tracking-wider">
                        <Trophy className="w-4 h-4" /> High Scores
                     </div>
                     <table className="w-full text-sm">
                       <thead>
                           <tr className="text-slate-500 border-b border-slate-700">
                               <th className="text-left pb-1 font-normal">Rank</th>
                               <th className="text-left pb-1 font-normal">Name</th>
                               <th className="text-right pb-1 font-normal">Score</th>
                           </tr>
                       </thead>
                       <tbody>
                         {highScores.map((hs, i) => (
                           <tr key={i} className={`${hs.score === finalScore && hs.name === (playerName || 'Anonymous') ? 'text-purple-300 bg-purple-900/20' : 'text-slate-300'}`}>
                             <td className="py-1 text-slate-500">#{i+1}</td>
                             <td className="py-1 font-medium">{hs.name}</td>
                             <td className="py-1 text-right font-mono">{hs.score}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                </div>
            )}

            <div className="space-y-3">
                <button
                  onClick={() => { setScoreSubmitted(false); setPlayerName(''); onRestart(); }}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Edit Another {isCatMode ? 'Meow' : 'Clip'}
                </button>
                <button
                  onClick={onMainMenu} 
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Menu className="w-4 h-4" />
                  Main Menu / Switch Mode
                </button>
            </div>
          </>
        )}

        {gameState === GameState.GAME_OVER && (
          <>
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/50">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Bad Splice</h2>
            <p className="text-slate-300 mb-8">
              {isCatMode 
                ? "You didn't select the ENTIRE Meow or left too much silence (10+ frames)."
                : "You included frames from the wrong clip color! The continuity is ruined."}
            </p>
            <div className="space-y-3">
                <button
                  onClick={onRestart}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={onMainMenu}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Menu className="w-4 h-4" />
                  Main Menu / Switch Mode
                </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Overlay;