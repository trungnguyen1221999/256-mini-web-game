import { useState, useEffect, useCallback, useRef } from 'react'
import { RotateCcw, Trophy, GamepadIcon, Clock, AlertCircle, QrCode, Camera, Download } from 'lucide-react'
import QrScanner from 'qr-scanner'
import './App.css'

const GRID_SIZE = 4;
const WIN_VALUE = 256; // Back to 256 as requested
const GAME_TIME = 300; // 5 minutes
const QR_SECRET = "256 game unlock"; // Match with your QR code from qr.io

function App() {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    const saved = localStorage.getItem('game256-unlocked');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [showScanner, setShowScanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  
  const [board, setBoard] = useState(() => {
    const saved = localStorage.getItem('game256-board');
    return saved ? JSON.parse(saved) : initializeBoard();
  });
  
  const [gameWon, setGameWon] = useState(() => {
    const saved = localStorage.getItem('game256-won');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [gameOver, setGameOver] = useState(() => {
    const saved = localStorage.getItem('game256-over');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem('game256-time');
    return saved ? parseInt(saved) : GAME_TIME;
  });
  
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [showConfetti, setShowConfetti] = useState(false);

  // PWA Install functionality
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallButton(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallButton(false);
    }
  };

  // QR Scanner functions
  const startQrScanner = async () => {
    setShowScanner(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        qrScannerRef.current = new QrScanner(
          videoRef.current,
          (result) => {
            if (result.data === QR_SECRET) {
              setIsUnlocked(true);
              localStorage.setItem('game256-unlocked', 'true');
              stopQrScanner();
            } else {
              alert('Invalid QR Code! Please scan the correct code to unlock the game.');
            }
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
          }
        );
        
        qrScannerRef.current.start();
      }
    } catch (error) {
      alert('Camera permission denied or not available!');
      setShowScanner(false);
    }
  };

  const stopQrScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current = null;
    }
    
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setShowScanner(false);
  };

  // Initialize empty board
  function initializeBoard() {
    const newBoard = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
    addNewTile(newBoard);
    addNewTile(newBoard);
    return newBoard;
  }

  // Add new tile (mostly 2s for easier gameplay)
  function addNewTile(board) {
    const emptyCells = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        if (board[i][j] === 0) {
          emptyCells.push({ row: i, col: j });
        }
      }
    }
    
    if (emptyCells.length > 0) {
      const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      // 90% chance for 2, 10% for 4 (balanced for 256 target)
      board[randomCell.row][randomCell.col] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  // Countdown timer
  useEffect(() => {
    if (gameWon || gameOver || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gameWon, gameOver, timeLeft]);

  // Play win sound
  const playWinSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
    oscillator.frequency.setValueAtTime(1046.50, audioContext.currentTime + 0.3); // C6
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  // Move and merge tiles
  function move(direction) {
    if (gameWon || gameOver || timeLeft <= 0) return;
    
    let newBoard = board.map(row => [...row]);
    let moved = false;

    // Rotate board for different directions
    if (direction === 'up') newBoard = rotateLeft(newBoard);
    if (direction === 'right') newBoard = rotateLeft(rotateLeft(newBoard));
    if (direction === 'down') newBoard = rotateRight(newBoard);

    // Move left (after rotation)
    for (let i = 0; i < GRID_SIZE; i++) {
      let row = newBoard[i].filter(val => val !== 0);
      
      // Merge tiles
      for (let j = 0; j < row.length - 1; j++) {
        if (row[j] === row[j + 1]) {
          row[j] *= 2;
          row[j + 1] = 0;
          
          // Check win condition
          if (row[j] === WIN_VALUE && !gameWon) {
            setGameWon(true);
            setShowConfetti(true);
            playWinSound();
            setTimeout(() => setShowConfetti(false), 3000);
          }
        }
      }
      
      // Remove zeros and pad right
      row = row.filter(val => val !== 0);
      while (row.length < GRID_SIZE) {
        row.push(0);
      }
      
      // Check if row changed
      for (let j = 0; j < GRID_SIZE; j++) {
        if (newBoard[i][j] !== row[j]) {
          moved = true;
        }
      }
      
      newBoard[i] = row;
    }

    // Rotate back to original orientation
    if (direction === 'up') newBoard = rotateRight(newBoard);
    if (direction === 'right') newBoard = rotateLeft(rotateLeft(newBoard));
    if (direction === 'down') newBoard = rotateLeft(newBoard);

    if (moved) {
      addNewTile(newBoard);
      setBoard(newBoard);
    }
  }

  function rotateLeft(matrix) {
    const n = matrix.length;
    const result = Array(n).fill().map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        result[n - 1 - j][i] = matrix[i][j];
      }
    }
    return result;
  }

  function rotateRight(matrix) {
    const n = matrix.length;
    const result = Array(n).fill().map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        result[j][n - 1 - i] = matrix[i][j];
      }
    }
    return result;
  }

  // Keyboard controls
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      move('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      move('down');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      move('right');
    }
  }, [board, gameWon]);

  // Touch controls
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e) => {
    if (!touchStart.x || !touchStart.y) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const minSwipeDistance = 50;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
          move('right');
        } else {
          move('left');
        }
      }
    } else {
      if (Math.abs(deltaY) > minSwipeDistance) {
        if (deltaY > 0) {
          move('down');
        } else {
          move('up');
        }
      }
    }
    
    setTouchStart({ x: 0, y: 0 });
  };

  // Reset game
  const resetGame = () => {
    const newBoard = initializeBoard();
    setBoard(newBoard);
    setGameWon(false);
    setGameOver(false);
    setTimeLeft(GAME_TIME);
    setShowConfetti(false);
    localStorage.removeItem('game256-board');
    localStorage.removeItem('game256-won');
    localStorage.removeItem('game256-over');
    localStorage.removeItem('game256-time');
  };

  // Save to localStorage
  useEffect(() => {
    if (isUnlocked) {
      localStorage.setItem('game256-board', JSON.stringify(board));
      localStorage.setItem('game256-won', JSON.stringify(gameWon));
      localStorage.setItem('game256-over', JSON.stringify(gameOver));
      localStorage.setItem('game256-time', timeLeft.toString());
    }
  }, [board, gameWon, gameOver, timeLeft, isUnlocked]);

  // Add keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  // Get tile color
  const getTileColor = (value) => {
    const colors = {
      0: 'bg-gray-200',
      2: 'bg-blue-100 text-gray-800',
      4: 'bg-blue-200 text-gray-800',
      8: 'bg-green-200 text-gray-800',
      16: 'bg-green-300 text-white',
      32: 'bg-yellow-300 text-gray-800',
      64: 'bg-orange-400 text-white',
      128: 'bg-red-500 text-white font-bold',
      256: 'bg-purple-600 text-white font-bold text-xl'
    };
    return colors[value] || 'bg-purple-700 text-white font-bold';
  };

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      
      {/* QR Code Scanner Landing Page */}
      {!isUnlocked && !showScanner && (
        <div className="text-center max-w-md mx-auto">
          <div className="bg-white p-8 rounded-xl shadow-2xl">
            <QrCode className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Game 256</h1>
            <p className="text-gray-600 mb-4">
              🔒 Game is locked! Find the QR code and scan it to unlock.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Look around for a printed QR code, then come back and scan it!
            </p>
            
            <button 
              onClick={startQrScanner}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-lg shadow flex items-center gap-2 mx-auto transition-colors mb-4"
            >
              <Camera className="w-5 h-5" />
              Scan QR Code to Unlock
            </button>
            
            {/* PWA Install Button */}
            {showInstallButton && (
              <button 
                onClick={handleInstallClick}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg shadow flex items-center gap-2 mx-auto transition-colors"
              >
                <Download className="w-5 h-5" />
                Install App
              </button>
            )}
            
            <p className="text-xs text-gray-400 mt-4">
              🎯 Hint: Look for the secret QR code around you!
            </p>
          </div>
        </div>
      )}

      {/* QR Scanner View */}
      {showScanner && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex justify-between items-center p-4 bg-black/80 text-white">
            <h2 className="text-lg font-bold">Scan QR Code to Unlock Game</h2>
            <button 
              onClick={stopQrScanner}
              className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded text-sm"
            >
              Cancel
            </button>
          </div>
          
          <div className="flex-1 relative">
            <video 
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 border-4 border-white/50 rounded-lg"></div>
            </div>
          </div>
          
          <div className="p-4 bg-black/80 text-white text-center">
            <p className="text-sm">Point your camera at the QR code to unlock the game</p>
          </div>
        </div>
      )}

      {/* Game Interface - Only shown when unlocked */}
      {isUnlocked && (
        <>
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <GamepadIcon className="w-6 h-6 text-indigo-600" />
              <h1 className="text-3xl md:text-5xl font-bold text-indigo-600">256</h1>
            </div>
            <p className="text-gray-600 mb-4 text-sm md:text-base">
              Reach <span className="font-bold text-purple-600">256</span> before time runs out!
            </p>
            
            {/* Timer and Reset */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className={`bg-white px-3 py-2 rounded-lg shadow flex items-center gap-2 ${
                timeLeft <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : ''
              }`}>
                <Clock className="w-4 h-4" />
                <span className="font-bold">{formatTime(timeLeft)}</span>
              </div>
              <button 
                onClick={resetGame}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg shadow flex items-center gap-2 transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                New Game
              </button>
            </div>
          </div>

          {/* Game Board */}
          <div 
            className={`bg-gray-400 p-3 rounded-xl shadow-2xl select-none ${
              gameOver && !gameWon ? 'opacity-50' : ''
            }`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="grid grid-cols-4 gap-2 w-64 h-64 md:w-72 md:h-72">
              {board.map((row, i) =>
                row.map((cell, j) => (
                  <div
                    key={`${i}-${j}`}
                    className={`
                      rounded-lg flex items-center justify-center text-lg md:text-xl font-bold
                      transition-all duration-200 ease-in-out
                      ${getTileColor(cell)}
                      ${cell !== 0 ? 'transform hover:scale-105' : ''}
                    `}
                  >
                    {cell !== 0 && cell}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Controls Info */}
          <div className="mt-6 text-center text-gray-600 max-w-md">
            <p className="text-xs md:text-sm mb-1">
              <strong>Desktop:</strong> Use arrow keys ↑↓←→
            </p>
            <p className="text-xs md:text-sm">
              <strong>Mobile:</strong> Swipe to move tiles
            </p>
          </div>

          {/* Confetti Animation */}
          {showConfetti && (
            <div className="fixed inset-0 pointer-events-none z-40">
              {[...Array(30)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-bounce text-2xl"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${1 + Math.random() * 2}s`
                  }}
                >
                  {Math.random() > 0.5 ? '🎉' : '🎈'}
                </div>
              ))}
            </div>
          )}

          {/* Game Over Popup */}
          {gameOver && !gameWon && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-2xl text-center max-w-sm mx-4">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">⏰ Time's Up!</h2>
                <p className="text-gray-600 mb-4 text-sm">
                  Don't worry! Try again and reach 256!
                </p>
                <button 
                  onClick={resetGame}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Play Again
                </button>
              </div>
            </div>
          )}

          {/* Win Popup */}
          {gameWon && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-2xl text-center max-w-sm mx-4 animate-bounce">
                <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">🎉 Amazing! 🎉</h2>
                <p className="text-gray-600 mb-3 text-sm">
                  You reached <span className="font-bold text-purple-600">256</span>!
                </p>
                <p className="text-lg font-bold text-green-600 mb-4">YOU WIN! 🏆</p>
                <div className="flex gap-2 justify-center">
                  <button 
                    onClick={() => setGameWon(false)}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                  >
                    Keep Playing
                  </button>
                  <button 
                    onClick={resetGame}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                  >
                    New Game
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App
