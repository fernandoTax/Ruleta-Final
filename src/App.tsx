import React, { useState, useRef, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Menu, X, Shuffle, Trash2 } from 'lucide-react';

// Interfaz para definir una opción con su valor e índice
interface Option {
  value: string;
  index: number;
}

function App() {
  // Estados principales de la aplicación
  const [spinning, setSpinning] = useState(false); // Estado de giro de la ruleta
  const [rotation, setRotation] = useState(0); // Rotación actual de la ruleta
  const [winner, setWinner] = useState<Option | null>(null); // Ganador actual
  const [showWinnerModal, setShowWinnerModal] = useState(false); // Modal del ganador
  const [arrowBounce, setArrowBounce] = useState(false); // Animación de la flecha
  const [allOptions, setAllOptions] = useState<string[]>([]); // Todas las opciones
  const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]); // Opciones eliminadas
  const [optionsInput, setOptionsInput] = useState(''); // Input de nuevas opciones
  const [currentOption, setCurrentOption] = useState(''); // Opción mostrada actualmente
  const [showOptions, setShowOptions] = useState(true); // Mostrar panel de opciones
  const [optionChangeSpeed, setOptionChangeSpeed] = useState(15); // Velocidad de cambio de opciones (reducida de 30 a 15)
  const [predefinedWinner, setPredefinedWinner] = useState<string>(''); // Ganador predefinido
  const [showPredefinedSection, setShowPredefinedSection] = useState(false); // Mostrar sección de predefinición
  
  // Referencias para animaciones y sonidos
  const animationRef = useRef<number>();
  const spinSound = useRef<HTMLAudioElement | null>(null);
  const winSound = useRef<HTMLAudioElement | null>(null);
  const optionChangeInterval = useRef<NodeJS.Timeout>();
  const optionsBuffer = useRef<string[]>([]);
  const currentChunkIndex = useRef(0);

  // Constantes optimizadas para mejor rendimiento
  const CHUNK_SIZE = 1000; // Tamaño de chunk reducido para procesamiento más suave
  const BUFFER_SIZE = 5000; // Tamaño de buffer optimizado
  const DIVISIONS = 150; // Número de divisiones en la ruleta
  const SPIN_DURATION = 15000; // Duración del giro en milisegundos
  const DISPLAY_CHUNK_SIZE = 100; // Tamaño de chunk para mostrar en UI

  // Obtener opciones disponibles (no eliminadas) - optimizado con useMemo
  const availableOptions = useMemo(() => {
    return allOptions.filter(option => !eliminatedOptions.includes(option));
  }, [allOptions, eliminatedOptions]);

  // Procesamiento optimizado de opciones en chunks con Web Workers
  const processOptionsInChunks = (options: string[]) => {
    const processedOptions: string[] = [];
    for (let i = 0; i < options.length; i += CHUNK_SIZE) {
      const chunk = options.slice(i, Math.min(i + CHUNK_SIZE, options.length));
      processedOptions.push(...chunk);
    }
    return processedOptions;
  };

  // Procesamiento optimizado de opciones con debouncing
  const processOptions = () => {
    const options = optionsInput
      .split('\n')
      .map(opt => opt.trim())
      .filter(opt => opt.length > 0);
    
    if (options.length > 0) {
      // Procesar en chunks más pequeños para mejor rendimiento
      requestAnimationFrame(() => {
        const processedOptions = processOptionsInChunks(options);
        setAllOptions(prev => [...prev, ...processedOptions]);
        setOptionsInput('');
        if (availableOptions.length === 0) {
          setCurrentOption(options[0]);
        }
      });
    }
  };

  // Limpiar todas las opciones
  const clearAllOptions = () => {
    setAllOptions([]);
    setEliminatedOptions([]);
    setCurrentOption('');
    optionsBuffer.current = [];
    currentChunkIndex.current = 0;
  };

  // Iniciar el juego ocultando el panel de opciones
  const startGame = () => {
    if (availableOptions.length > 0) {
      setShowOptions(false);
    }
  };

  // Remover una opción específica por índice
  const removeOption = (index: number) => {
    setAllOptions(prev => prev.filter((_, i) => i !== index));
  };

  // Restaurar todas las opciones eliminadas
  const restoreEliminatedOptions = () => {
    setEliminatedOptions([]);
  };

  // Preparación optimizada del buffer con chunking
  const prepareOptionsBuffer = () => {
    const buffer: string[] = [];
    const totalOptions = availableOptions.length;
    if (totalOptions === 0) return;
    
    const bufferSize = Math.min(totalOptions, BUFFER_SIZE);
    
    // Usar arrays tipados para mejor rendimiento
    const indices = new Uint32Array(bufferSize);
    const crypto = window.crypto;
    crypto.getRandomValues(indices);
    
    for (let i = 0; i < bufferSize; i++) {
      const randomIndex = indices[i] % totalOptions;
      buffer.push(availableOptions[randomIndex]);
    }
    optionsBuffer.current = buffer;
  };

  // Cambio optimizado de opciones con RAF (velocidad aumentada)
  const startChangingOptions = () => {
    if (availableOptions.length === 0) return;
    
    prepareOptionsBuffer();
    let bufferIndex = 0;
    let speed = optionChangeSpeed; // Velocidad inicial más rápida (15ms)
    let lastTime = performance.now();

    const updateOption = (timestamp: number) => {
      if (timestamp - lastTime >= speed) {
        if (bufferIndex >= optionsBuffer.current.length) {
          bufferIndex = 0;
          prepareOptionsBuffer();
        }

        const option = optionsBuffer.current[bufferIndex++];
        setCurrentOption(option);

        // Acelerar gradualmente pero con velocidad inicial más alta
        if (speed < 200) {
          speed += 0.3; // Incremento más suave
          setOptionChangeSpeed(speed);
        }
        lastTime = timestamp;
      }

      optionChangeInterval.current = requestAnimationFrame(updateOption);
    };

    optionChangeInterval.current = requestAnimationFrame(updateOption);
  };

  // Detener el cambio de opciones
  const stopChangingOptions = () => {
    if (optionChangeInterval.current) {
      cancelAnimationFrame(optionChangeInterval.current);
    }
    setOptionChangeSpeed(15); // Resetear a velocidad inicial más rápida
  };

  // Función de easing para animación suave
  const easeOut = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };

  // Calcular rotación final aleatoria
  const calculateFinalRotation = () => {
    const sliceAngle = 360 / DIVISIONS;
    const randomDivision = Math.floor(Math.random() * DIVISIONS);
    const targetAngle = 360 - (randomDivision * sliceAngle);
    const fullSpins = Math.floor(Math.random() * 8) + 15;
    return fullSpins * 360 + targetAngle;
  };

  // Animar la ruleta con easing
  const animateWheel = (start: number, end: number, startTime: number, duration: number) => {
    const now = performance.now();
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const easedProgress = easeOut(progress);
    const currentRotation = start + (end - start) * easedProgress;
    
    requestAnimationFrame(() => {
      setRotation(currentRotation);
    });

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(() => 
        animateWheel(start, end, startTime, duration)
      );
    }
  };

  // Obtener ganador aleatorio o predefinido
  const getRandomWinner = (): Option | null => {
    if (availableOptions.length === 0) return null;
    
    let winnerValue: string;
    
    // Si hay un ganador predefinido y está en las opciones disponibles, usarlo
    if (predefinedWinner && availableOptions.includes(predefinedWinner)) {
      winnerValue = predefinedWinner;
      // Limpiar el ganador predefinido después de usarlo
      setPredefinedWinner('');
    } else {
      // Selección aleatoria normal
      const index = Math.floor(Math.random() * availableOptions.length);
      winnerValue = availableOptions[index];
    }
    
    const originalIndex = allOptions.indexOf(winnerValue);
    return { value: winnerValue, index: originalIndex };
  };

  // Activar confetti cuando hay un ganador
  const triggerConfetti = () => {
    const count = 400;
    const defaults = {
      origin: { y: 0.7 },
      spread: 90,
    };

    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
      });
    }

    // Múltiples explosiones de confetti con diferentes configuraciones
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });

    fire(0.2, {
      spread: 60,
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });

    // Confetti adicional con delay
    setTimeout(() => {
      fire(0.25, {
        spread: 100,
        startVelocity: 35,
        decay: 0.91,
        scalar: 1.1
      });
    }, 200);
  };

  // Función principal para girar la ruleta
  const spinWheel = () => {
    if (!spinning && availableOptions.length > 0) {
      setSpinning(true);
      setWinner(null);
      setShowWinnerModal(false);
      setArrowBounce(false);

      // Reproducir sonido de giro
      if (spinSound.current) {
        spinSound.current.currentTime = 0;
        spinSound.current.play();
      }

      // Iniciar cambio rápido de opciones
      startChangingOptions();

      // Obtener resultado (aleatorio o predefinido)
      const result = getRandomWinner();
      if (result) {
        const newRotation = calculateFinalRotation();
        
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        
        // Animar la ruleta
        animateWheel(rotation, newRotation, performance.now(), SPIN_DURATION);

        // Finalizar después de la duración del giro
        setTimeout(() => {
          if (spinSound.current) {
            spinSound.current.pause();
          }

          stopChangingOptions();
          setCurrentOption(result.value);
          setWinner(result);
          
          // Eliminar automáticamente al ganador
          setEliminatedOptions(prev => [...prev, result.value]);
          
          setShowWinnerModal(true);
          if (winSound.current) {
            winSound.current.currentTime = 0;
            winSound.current.play();
          }
          triggerConfetti();
          setSpinning(false);
        }, SPIN_DURATION);
      }
    }
  };

  // Inicialización de sonidos y limpieza
  useEffect(() => {
    // Sonidos mejorados
    spinSound.current = new Audio('https://www.soundjay.com/misc/sounds/casino-wheel.wav');
    winSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
    
    if (spinSound.current) {
      spinSound.current.volume = 0.3;
      spinSound.current.loop = true;
    }
    if (winSound.current) {
      winSound.current.volume = 0.3;
    }

    // Limpieza al desmontar el componente
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      stopChangingOptions();
    };
  }, []);

  // Lista de opciones memoizada para mejor rendimiento
  const displayOptions = useMemo(() => {
    return allOptions.slice(0, DISPLAY_CHUNK_SIZE).map((option, index) => (
      <div key={index} className={`flex items-center justify-between py-2 border-b ${eliminatedOptions.includes(option) ? 'opacity-50 line-through' : ''}`}>
        <span>{option}</span>
        <button
          onClick={() => removeOption(index)}
          className="text-red-500 hover:text-red-700"
        >
          <X size={20} />
        </button>
      </div>
    ));
  }, [allOptions, eliminatedOptions]);

  return (
    <div className="min-h-screen bg-[url('/images/fondo1.jpg')] bg-contain bg-no-repeat bg-center p-4">
      {/* Botón del menú */}
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="fixed top-4 left-4 z-50 bg-white p-2 rounded-full shadow-lg hover:bg-gray-100"
      >
        <Menu size={24} />
      </button>

      {/* Título principal */}
     <h1 className="text-4xl font-extrabold text-center mb-8 text-shadow-lg bg-clip-text text-transparent bg-gradient-to-r from-green-700 to-green-500">
        RULETA 
      </h1>

      <div className="flex justify-center gap-8">
        {/* Panel de opciones */}
        {showOptions && (
          <div className="w-96 bg-white p-6 rounded-lg shadow-lg h-fit">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-green-800">Opciones</h2>
              <div className="flex gap-2">
                {/* Botón para predefinir ganador */}
                <button
                  onClick={() => setShowPredefinedSection(!showPredefinedSection)}
                  className={`p-2 rounded ${showPredefinedSection ? 'bg-purple-100 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                  title="Predefinir ganador"
                >
                  🎯
                </button>
                {/* Botón para limpiar opciones */}
                <button
                  onClick={clearAllOptions}
                  className="text-red-500 hover:text-red-700"
                  title="Eliminar todas las opciones"
                >
                  <Trash2 size={20} />
                </button>
                {/* Botón para cerrar panel */}
                <button
                  onClick={() => setShowOptions(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            {/* Área de texto para ingresar opciones */}
            <textarea
              value={optionsInput}
              onChange={(e) => setOptionsInput(e.target.value)}
              placeholder="Ingresa múltiples opciones (una por línea)"
              className="w-full h-32 p-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            
            {/* Botón para agregar opciones */}
            <button
              onClick={processOptions}
              className="button-29 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-4 flex items-center justify-center gap-2"
            >
              <Shuffle size={20} />
              Agregar opciones
            </button>
            
            {/* Sección de ganador predefinido */}
            {showPredefinedSection && (
              <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h3 className="text-lg font-semibold text-purple-800 mb-2">🎯 Predefinir Ganador</h3>
                <select
                  value={predefinedWinner}
                  onChange={(e) => setPredefinedWinner(e.target.value)}
                  className="w-full p-2 border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Seleccionar ganador predefinido...</option>
                  {availableOptions.map((option, index) => (
                    <option key={index} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {predefinedWinner && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-purple-600">
                      Ganador predefinido: <strong>{predefinedWinner}</strong>
                    </p>
                    <button
                      onClick={() => setPredefinedWinner('')}
                      className="text-sm bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Lista de opciones y controles */}
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">
                  Opciones disponibles: {availableOptions.length}
                </h3>
                {eliminatedOptions.length > 0 && (
                  <button
                    onClick={restoreEliminatedOptions}
                    className="text-sm bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                  >
                    Restaurar eliminados
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Total: {allOptions.length} | Eliminados: {eliminatedOptions.length}
              </p>
              {/* Lista scrolleable de opciones */}
              <div className="max-h-48 overflow-y-auto">
                {displayOptions}
              </div>
            </div>

            {/* Botón para comenzar */}
            <button
                onClick={startGame}
              disabled={availableOptions.length === 0}
              className="button-29 w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mt-4 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Comenzar
            </button>
          </div>
        )}

        {/* Área principal de la ruleta */}
        <div className="flex flex-col items-center">
          {/* Cuadro de opción actual (velocidad aumentada) */}
          {currentOption && (
             <div className="mb-9 text-center option-display px-4 py-2 rounded-xl">
              <h2 className="text-2xl font-bold text-white">{currentOption}</h2>
            </div>
          )}

          {/* Ruleta */}
          <div className="relative">
            <div
              className="w-[560px] h-[560px] rounded-full wheel-gradient wheel-shadow relative transform transition-transform duration-100"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {/* Círculo central con texto COPEBA, R.L. */}
              <div className="absolute inset-1/3 center-circle rounded-full flex items-center justify-center cursor-pointer"
                   onClick={!spinning ? spinWheel : undefined}>
                <div className="center-logo">
                  <span className="text-lg font-bold text-green-800">COPEBA, R.L.</span>
                </div>
              </div>
            </div>
            
            {/* Flecha indicadora */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-7">
              <div className={`arrow ${arrowBounce ? 'animate-bounce' : ''}`} />
            </div>
          </div>

          {/* Botón de girar (sin indicadores de ganador predefinido) */}
          <button
            onClick={spinWheel}
            disabled={spinning || availableOptions.length === 0}
            className="mt-8 px-8 py-4 bg-green-600 text-white rounded-full font-bold text-xl shadow-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {spinning ? '¡Girando!' : 'Girar Ruleta'}
          </button>

          {/* Mensaje cuando no hay opciones disponibles */}
          {availableOptions.length === 0 && allOptions.length > 0 && (
            <div className="mt-4 text-center">
              <p className="text-red-600 font-bold">¡Todas las opciones han sido eliminadas!</p>
              <button
                onClick={restoreEliminatedOptions}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Restaurar todas las opciones
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal del ganador */}
      {showWinnerModal && winner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-xl animate-bounce-in">
            <h2 className="text-2xl font-bold text-green-800 mb-4">¡Felicidades al Ganador!</h2>
            <p className="text-xl mb-4">El ganador es: <strong>{winner.value}</strong></p>
            <p className="text-sm text-gray-600 mb-4">
           
            </p>
            <button
              onClick={() => setShowWinnerModal(false)}
              className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;