
import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';

// --- Types ---
type Tab = 'now_playing' | 'playlist' | 'history';
type Theme = 'wmp10' | 'groove' | 'winamp3' | 'winamp5' | 'jetaudio4' | 'winamp_classic' | 'xbox';

interface Song {
  id: string;
  name: string;
  file: File;
  url: string;
  type: 'audio' | 'video';
  duration?: number;
}

interface Playlist {
  id: string;
  name: string;
  songs: Song[];
}

// --- Constants ---
const ACCEPTED_FILES = ".mp3,.aac,.flac,.wav,.wma,.avi,.mp4,.wmv,.flv,.xvid,.divx,.mpg,.mpeg,.mkv,.mov,audio/*,video/*";

const getMediaType = (file: File): 'audio' | 'video' => {
    const n = file.name.toLowerCase();
    // Video extensions
    if (n.endsWith('.avi') || n.endsWith('.mp4') || n.endsWith('.wmv') || n.endsWith('.flv') || n.endsWith('.xvid') || n.endsWith('.divx') || n.endsWith('.mpg') || n.endsWith('.mpeg') || n.endsWith('.mkv') || n.endsWith('.mov') || n.endsWith('.webm') || n.endsWith('.ogv') || n.endsWith('.3gp')) {
        return 'video';
    }
    // Browser MIME check
    if (file.type.startsWith('video/')) return 'video';
    
    // Default to audio for everything else (mp3, wma, wav, flac, aac, etc.)
    return 'audio';
}

const EQ_BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
const EQ_PRESETS: { [key: string]: number[] } = {
    'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'Rock': [5, 4, 3, 1, -1, -1, 1, 3, 4, 5],
    'Pop': [-1, -1, 0, 2, 4, 4, 2, 0, -1, -1],
    'Jazz': [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
    'Techno': [4, 3, 0, -2, -3, -2, 0, 3, 4, 4],
    'Hip-Hop': [5, 4, 0, 0, -1, -1, 0, 0, 2, 3],
    'Classical': [0, 0, 0, 0, 0, 0, -2, -2, -2, -4],
    'Metal': [6, 5, 0, 0, -3, 0, 3, 5, 6, 7],
    'Dance': [4, 6, 2, 0, 0, -2, -4, -4, 0, 0],
    'Live': [-3, 0, 2, 3, 4, 4, 3, 2, 1, 1],
};

// --- Icons ---
const Icons = {
  Music: () => <i className="fas fa-music"></i>,
  Video: () => <i className="fas fa-film"></i>,
  Play: () => <i className="fas fa-play"></i>,
  Pause: () => <i className="fas fa-pause"></i>,
  Stop: () => <i className="fas fa-stop"></i>,
  Prev: () => <i className="fas fa-step-backward"></i>,
  Next: () => <i className="fas fa-step-forward"></i>,
  Folder: () => <i className="fas fa-folder-open"></i>,
  Trash: () => <i className="fas fa-trash-alt"></i>,
  Plus: () => <i className="fas fa-plus"></i>,
  List: () => <i className="fas fa-list"></i>,
  Wave: () => <i className="fas fa-wave-square"></i>,
  Palette: () => <i className="fas fa-palette"></i>,
  Eye: () => <i className="fas fa-eye"></i>,
  EyeSlash: () => <i className="fas fa-eye-slash"></i>,
  Tshirt: () => <i className="fas fa-tshirt"></i>, // Skin icon
  Expand: () => <i className="fas fa-expand"></i>,
  Compress: () => <i className="fas fa-compress"></i>,
  Check: () => <i className="fas fa-check"></i>,
  Times: () => <i className="fas fa-times"></i>,
  Repeat: () => <i className="fas fa-repeat"></i>,
  Shuffle: () => <i className="fas fa-shuffle"></i>,
  Eject: () => <i className="fas fa-eject"></i>,
  Sliders: () => <i className="fas fa-sliders-h"></i>,
  Exclamation: () => <i className="fas fa-exclamation-triangle"></i>,
};

const themes: {id: Theme, name: string}[] = [
    { id: 'wmp10', name: 'Windows Media Player 10' },
    { id: 'groove', name: 'Groove Music (Dark)' },
    { id: 'winamp_classic', name: 'Winamp Classic (Real)' },
    { id: 'winamp3', name: 'Winamp 3 (Modern)' },
    { id: 'winamp5', name: 'Winamp 5 (Silver)' },
    { id: 'jetaudio4', name: 'JetAudio 4 (Blue)' },
    { id: 'xbox', name: 'Original Xbox' },
];

const App = () => {
  const [activeTab, setActiveTab] = useState<Tab>('now_playing');
  const [currentTheme, setCurrentTheme] = useState<Theme>('wmp10');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  
  // --- Global Playback State ---
  const [playlists, setPlaylists] = useState<Playlist[]>([
    { id: 'default', name: 'Default Playlist', songs: [] }
  ]);
  const [history, setHistory] = useState<Song[]>([]);
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [prevVolume, setPrevVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // New States for Playback Modes
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isShuffle, setIsShuffle] = useState(false);

  // Refs for media persistence
  const mediaRef = useRef<HTMLVideoElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const themeBtnRef = useRef<HTMLDivElement>(null);
  const globalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (
              themeMenuRef.current && 
              !themeMenuRef.current.contains(event.target as Node) &&
              themeBtnRef.current &&
              !themeBtnRef.current.contains(event.target as Node)
            ) {
              setShowThemeMenu(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      
      const handleFsChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFsChange);

      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
          document.removeEventListener('fullscreenchange', handleFsChange);
      };
  }, []);

  // --- Playback Logic ---

  const playSong = (song: Song) => {
    // Check if song is already in queue
    const idx = queue.findIndex(s => s.id === song.id);
    if (idx !== -1) {
      setCurrentSongIndex(idx);
    } else {
      // Add to queue and play
      const newQueue = [...queue, song];
      setQueue(newQueue);
      setCurrentSongIndex(newQueue.length - 1);
    }
    setIsPlaying(true);
    addToHistory(song);
    setActiveTab('now_playing');
  };

  const playQueueIndex = (index: number) => {
    if (index >= 0 && index < queue.length) {
      setCurrentSongIndex(index);
      setIsPlaying(true);
      addToHistory(queue[index]);
    }
  };

  const addToHistory = (song: Song) => {
    setHistory(prev => {
        // Avoid duplicates at the top
        if (prev.length > 0 && prev[0].id === song.id) return prev;
        return [song, ...prev].slice(0, 50); // Keep last 50
    });
  };

  const loadPlaylistToQueue = (playlistId: string) => {
    const pl = playlists.find(p => p.id === playlistId);
    if (pl && pl.songs.length > 0) {
      setQueue([...pl.songs]);
      setCurrentSongIndex(0);
      setIsPlaying(true);
      addToHistory(pl.songs[0]);
      setActiveTab('now_playing');
    }
  };

  const handleQuickOpen = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files: File[] = Array.from(e.target.files);
    const newSongs: Song[] = files.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        file: file,
        url: URL.createObjectURL(file),
        type: getMediaType(file)
    }));

    // Replace current queue with these files
    setQueue(newSongs);
    setCurrentSongIndex(0);
    setIsPlaying(true);
    addToHistory(newSongs[0]);
    
    // Clear input
    e.target.value = '';
  };

  const handleNext = () => {
    if (queue.length === 0) return;

    if (isShuffle) {
        // Shuffle Logic
        let nextIndex;
        if (queue.length === 1) {
            nextIndex = 0;
        } else {
             // Pick random index different from current
             do {
                 nextIndex = Math.floor(Math.random() * queue.length);
             } while (nextIndex === currentSongIndex);
        }
        playQueueIndex(nextIndex);
    } else {
        // Normal Logic
        if (currentSongIndex < queue.length - 1) {
            playQueueIndex(currentSongIndex + 1);
        } else {
            // End of list
            if (repeatMode === 'all') {
                playQueueIndex(0); // Loop back
            } else {
                setIsPlaying(false); // Stop
            }
        }
    }
  };

  const handlePrev = () => {
    if (currentTime > 3) {
      if (mediaRef.current) mediaRef.current.currentTime = 0;
    } else {
      if (currentSongIndex > 0) {
        playQueueIndex(currentSongIndex - 1);
      } else {
         if (mediaRef.current) mediaRef.current.currentTime = 0;
      }
    }
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
      setDuration(mediaRef.current.duration || 0);
    }
  };

  const handleEnded = () => {
    if (repeatMode === 'one') {
        if (mediaRef.current) {
            mediaRef.current.currentTime = 0;
            mediaRef.current.play().catch(e => { if(e.name !== 'AbortError' && e.name !== 'NotSupportedError') console.error(e) });
        }
    } else {
        handleNext();
    }
  };

  const togglePlay = () => {
    if (queue.length === 0) return;
    setIsPlaying(!isPlaying);
  };
  
  const toggleMute = () => {
    if (volume > 0) {
        setPrevVolume(volume);
        setVolume(0);
    } else {
        setVolume(prevVolume > 0 ? prevVolume : 0.5);
    }
  };
  
  const toggleRepeat = () => {
      // Off -> All -> One -> Off
      if (repeatMode === 'off') setRepeatMode('all');
      else if (repeatMode === 'all') setRepeatMode('one');
      else setRepeatMode('off');
  };

  const toggleShuffle = () => {
      setIsShuffle(!isShuffle);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  };

  // Effect to sync audio element with state
  useEffect(() => {
    if (!mediaRef.current) return;
    
    if (isPlaying) {
        if (mediaRef.current.paused) {
             const playPromise = mediaRef.current.play();
             if (playPromise !== undefined) {
                playPromise.catch(error => {
                    // Ignore AbortError and NotSupportedError to prevent console noise
                    if (error.name === 'AbortError' || error.name === 'NotSupportedError') return;
                    console.log("Auto-play prevented", error);
                    setIsPlaying(false);
                });
             }
        }
    } else {
        mediaRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!mediaRef.current) return;
    mediaRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (currentSongIndex >= 0 && queue[currentSongIndex] && mediaRef.current) {
        const newUrl = queue[currentSongIndex].url;
        // Optimization: Don't reset src if it's the same, unless needed
        if (mediaRef.current.src !== newUrl) {
            mediaRef.current.src = newUrl;
        }
        
        if (isPlaying) {
             const p = mediaRef.current.play();
             if (p && typeof p.then === 'function') {
                p.catch(e => {
                    // Suppress logs for common playback interruptions and unsupported formats
                    if (e.name === 'AbortError') return;
                    if (e.name === 'NotSupportedError') return; 
                    // Error 4 handling happens in onError event, so suppress logging here
                    if (e.code === 4 || (e.message && e.message.includes("supported"))) return;
                    console.error("Play error", e);
                });
             }
        }
    }
  }, [currentSongIndex, queue]);

  const formatTime = (s: number) => {
    if (!s) return "00:00";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins < 10 ? '0'+mins : mins}:${secs < 10 ? '0' + secs : secs}`;
  };

  const currentSong = currentSongIndex >= 0 ? queue[currentSongIndex] : null;

  // Move VolumeIcon definition outside render to avoid recreation
  const getVolumeIcon = (vol: number) => {
      if (vol === 0) return <i className="fas fa-volume-mute"></i>;
      if (vol < 0.5) return <i className="fas fa-volume-down"></i>;
      return <i className="fas fa-volume-up"></i>;
  };
  
  const getActiveBtnStyle = () => {
      if (currentTheme === 'wmp10') return { color: '#1d53a8', textShadow: '0 0 5px #fff' };
      if (currentTheme === 'groove') return { color: '#FF4081' };
      if (currentTheme === 'winamp3') return { color: '#FF9900' };
      if (currentTheme === 'winamp5' || currentTheme === 'winamp_classic') return { color: '#00FF00', background: '#333', borderStyle: 'inset' };
      if (currentTheme === 'jetaudio4') return { color: '#00FFFF', textShadow: '0 0 5px #00FFFF' };
      if (currentTheme === 'xbox') return { color: '#5dc21e', textShadow: '0 0 5px #5dc21e' };
      return { fontWeight: 'bold' };
  };

  // --- RENDER XBOX LAYOUT ---
  if (currentTheme === 'xbox') {
      return (
        <div className="player-container theme-xbox" style={{width: isFullscreen ? '100vw' : 'auto', height: isFullscreen ? '100vh' : 'auto'}}>
             
             {/* New Organic Layout */}
             <div className="xbox-skin-body">
                 
                 {/* Layer 0: Green Glow Aura */}
                 <div className="xbox-glow-layer"></div>

                 {/* Layer 1: Main Metal Chassis */}
                 <div className="xbox-metal-pod">
                    
                    {/* Top Island (Window Controls) */}
                    <div className="xbox-top-island">
                         <div className="xbox-win-btn" onClick={() => setShowThemeMenu(!showThemeMenu)} title="Menu">_</div>
                         <div className="xbox-win-btn" onClick={toggleFullscreen} title="Fullscreen">□</div>
                         <div className="xbox-win-btn" onClick={() => {}} title="Close">x</div>
                         {showThemeMenu && (
                            <div className="theme-menu xbox-theme-menu" ref={themeMenuRef}>
                                {themes.map(t => (
                                    <div key={t.id} className="theme-option" onClick={() => {setCurrentTheme(t.id); setShowThemeMenu(false);}}>
                                        {t.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Recess for Extra Controls (File, Shuffle) - Positioned in the void between brow and jewel */}
                    <div className="xbox-control-recess">
                         <div className="xbox-recess-btn" onClick={() => globalFileInputRef.current?.click()} title="Open Media">
                            <i className="fas fa-folder"></i>
                         </div>
                         <div className={`xbox-recess-btn ${isShuffle ? 'active' : ''}`} onClick={toggleShuffle} title="Shuffle">
                            <div className="xbox-led"></div>
                         </div>
                         <div className={`xbox-recess-btn ${repeatMode !== 'off' ? 'active' : ''}`} onClick={toggleRepeat} title="Repeat">
                            <div className="xbox-led repeat"></div>
                         </div>
                    </div>

                    {/* Glossy Overlay Highlight for Chassis */}
                    <div className="xbox-chassis-shine"></div>

                    {/* The Jewel Socket (Left) */}
                    <div className="xbox-jewel-socket">
                        <div className="xbox-jewel-dome">
                            <div className="xbox-x-logo"></div>
                            <div className="xbox-jewel-shine"></div>
                        </div>
                    </div>

                    {/* The Screen Socket (Right) */}
                    <div className="xbox-screen-socket">
                        <div className="xbox-lens-glass">
                            <VisualizerScreen 
                                mediaRef={mediaRef} currentSong={currentSong} queue={queue} currentSongIndex={currentSongIndex}
                                theme={currentTheme} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} onFileSelect={handleQuickOpen} onPlayIndex={playQueueIndex}
                            />
                            {/* Overlay effects */}
                            <div className="xbox-scanlines"></div>
                            <div className="xbox-screen-glare"></div>
                            
                            {/* In-screen UI - Curved bottom alignment */}
                            <div className="xbox-lens-ui">
                                 <div className="xbox-ui-row">
                                    <div className="xbox-marquee">
                                        {currentSong ? `${currentSongIndex + 1}. ${currentSong.name}` : 'NO DISC'}
                                    </div>
                                 </div>
                                 <div className="xbox-ui-row controls">
                                    <span className="time">{formatTime(currentTime)}</span>
                                    <div className="vol-bar">
                                        <i className="fas fa-volume-up"></i>
                                        <div className="xbox-vol-slider-wrap">
                                            <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} />
                                        </div>
                                    </div>
                                 </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Curved Control Strip */}
                    <div className="xbox-bottom-curve">
                        <div className="xbox-btn-sliver" onClick={handlePrev} title="Previous"><Icons.Prev/></div>
                        <div className="xbox-btn-sliver" onClick={() => {setIsPlaying(false); setCurrentTime(0); if(mediaRef.current) mediaRef.current.currentTime=0;}} title="Stop"><Icons.Stop/></div>
                        <div className="xbox-btn-sliver large" onClick={togglePlay} title="Play/Pause">
                            {isPlaying ? <Icons.Pause/> : <Icons.Play/>}
                        </div>
                        <div className="xbox-btn-sliver" onClick={handleNext} title="Next"><Icons.Next/></div>
                        <div className="xbox-btn-sliver" onClick={() => globalFileInputRef.current?.click()} title="Eject"><Icons.Eject/></div>
                    </div>

                 </div>
             </div>

             {/* Hidden Global Input */}
             <input type="file" multiple accept={ACCEPTED_FILES} ref={globalFileInputRef} style={{display: 'none'}} onChange={handleQuickOpen} />
        </div>
      );
  }

  // --- RENDER STANDARD / WINAMP CLASSIC LAYOUTS ---
  return (
    <div className={`player-container theme-${currentTheme}`} style={{width: isFullscreen ? '100vw' : '98%', height: isFullscreen ? '100vh' : '96vh', maxWidth: isFullscreen ? 'none' : '1600px'}}>
      
      {/* 1. Title Bar */}
      {!isFullscreen && (
      <div className="wmp-title-bar">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {currentTheme === 'winamp5' && <i className="fas fa-bolt" style={{marginRight: 8, color: '#ffcc00'}}></i>}
          {(currentTheme === 'winamp_classic') && <i className="fas fa-bolt" style={{marginRight: 8, color: '#ddd'}}></i>}
          {currentTheme === 'wmp10' && <i className="fab fa-windows" style={{marginRight: 8}}></i>}
          {currentTheme === 'groove' && <i className="fas fa-headphones-alt" style={{marginRight: 8}}></i>}
          {currentTheme === 'jetaudio4' && <i className="fas fa-plane" style={{marginRight: 8}}></i>}
          <span>Media Player</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems:'center' }}>
          
          {/* Skin Button with Dropdown Menu */}
          <div style={{position: 'relative'}}>
            <div className="win-btn min" onClick={() => setShowThemeMenu(!showThemeMenu)} title="Change Theme / Skin" ref={themeBtnRef}>
               <i className="fas fa-tshirt"></i>
            </div>
            {showThemeMenu && (
                <div className="theme-menu" ref={themeMenuRef}>
                    {themes.map(t => (
                        <div key={t.id} className="theme-option" onClick={() => {setCurrentTheme(t.id); setShowThemeMenu(false);}} style={{fontWeight: currentTheme === t.id ? 'bold' : 'normal'}}>
                            {t.name}
                        </div>
                    ))}
                </div>
            )}
          </div>

          <div className="win-btn max" onClick={() => globalFileInputRef.current?.click()} title="Open File...">
             <i className="fas fa-folder-open"></i>
          </div>
          <div className="win-btn close" onClick={toggleFullscreen} title="Toggle Fullscreen">
             <i className="fas fa-expand"></i>
          </div>

        </div>
      </div>
      )}

      {/* Global File Input */}
      <input type="file" multiple accept={ACCEPTED_FILES} ref={globalFileInputRef} style={{display: 'none'}} onChange={handleQuickOpen} />

      {/* 2. Menu / Tabs */}
      {!isFullscreen && (
      <div className="wmp-tabs">
        <button className={`btn-tab ${activeTab === 'now_playing' ? 'active' : ''}`} onClick={() => setActiveTab('now_playing')}>
            <span>Now Playing</span>
        </button>
        <button className={`btn-tab ${activeTab === 'playlist' ? 'active' : ''}`} onClick={() => setActiveTab('playlist')}>
            <span>Playlist</span>
        </button>
        <button className={`btn-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <span>History</span>
        </button>
      </div>
      )}

      {/* 3. Main Content Area */}
      <div className="wmp-main-area">
        
        {/* Visualizer / Video */}
        <div className="screen-content" style={{ display: activeTab === 'now_playing' ? 'flex' : 'none', flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
            <VisualizerScreen 
                mediaRef={mediaRef} currentSong={currentSong} queue={queue} currentSongIndex={currentSongIndex}
                theme={currentTheme} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} onFileSelect={handleQuickOpen} onPlayIndex={playQueueIndex}
            />
        </div>

        {/* Playlist Manager */}
        <div className="screen-content" style={{ display: activeTab === 'playlist' ? 'flex' : 'none', flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
             <PlaylistManager playlists={playlists} setPlaylists={setPlaylists} onPlayPlaylist={loadPlaylistToQueue} currentQueueId={null} theme={currentTheme} />
        </div>

        {/* History */}
        <div className="screen-content" style={{ display: activeTab === 'history' ? 'flex' : 'none', flex: 1, width: '100%', height: '100%', padding: 20, flexDirection: 'column', alignItems: 'flex-start', overflowY: 'auto', boxSizing: 'border-box' }}>
            <h3 style={{marginTop:0, color: 'inherit'}}>Playback History</h3>
            <div className="wmp-list-view" style={{width: '100%'}}>
                 <div className="wmp-list-header">
                    <div style={{width: '50%'}}>Name</div>
                    <div style={{width: '30%'}}>Type</div>
                    <div style={{width: '20%'}}>Action</div>
                 </div>
                 {history.length === 0 && <div style={{padding: 20, textAlign: 'center', opacity: 0.7}}>No history yet.</div>}
                 {history.map((song, i) => (
                     <div key={i} className="wmp-list-row">
                         <div style={{width: '50%'}}>{song.name}</div>
                         <div style={{width: '30%'}}>{song.type.toUpperCase()}</div>
                         <div style={{width: '20%'}}>
                             <button className="btn-small" onClick={() => playSong(song)}><Icons.Play/></button>
                         </div>
                     </div>
                 ))}
            </div>
        </div>

      </div>

      {/* 4. Controls */}
      <div className="wmp-controls">
        
        {/* === SPECIAL WINAMP CLASSIC LAYOUT === */}
        {currentTheme === 'winamp_classic' ? (
            <div className="winamp-classic-layout">
                {/* LCD AREA */}
                <div className="winamp-lcd-panel">
                    <div className="winamp-lcd-time">{currentSong ? formatTime(currentTime) : '00:00'}</div>
                    <div className="winamp-lcd-marquee">
                        {currentSong ? `${currentSongIndex + 1}. ${currentSong.name} (${isPlaying?'Playing':'Stopped'})` : 'WINAMP 2.91 - DEMO MODE'}
                    </div>
                    <div className="winamp-lcd-specs">
                        <div>128</div><div>kbps</div>
                        <div>44</div><div>kHz</div>
                    </div>
                </div>

                {/* SLIDER AREA */}
                <div className="winamp-seek-row">
                    <input 
                        type="range" min="0" max={duration || 100} value={currentTime} 
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setCurrentTime(val);
                            if (mediaRef.current) mediaRef.current.currentTime = val;
                        }}
                    />
                </div>

                {/* CONTROLS ROW */}
                <div className="winamp-btn-row">
                    <button className="btn-wmp" onClick={handlePrev} title="Prev"><Icons.Prev/></button>
                    <button className="btn-wmp" onClick={togglePlay} title="Play"><Icons.Play/></button>
                    <button className="btn-wmp" onClick={togglePlay} title="Pause"><Icons.Pause/></button>
                    <button className="btn-wmp" onClick={() => { setIsPlaying(false); setCurrentTime(0); if(mediaRef.current) mediaRef.current.currentTime=0; }} title="Stop"><Icons.Stop/></button>
                    <button className="btn-wmp" onClick={handleNext} title="Next"><Icons.Next/></button>
                    
                    <button className="btn-wmp eject" onClick={() => globalFileInputRef.current?.click()} title="Open"><Icons.Eject/></button>
                    
                    <div className="winamp-toggles">
                         <div className={`winamp-toggle ${isShuffle ? 'active' : ''}`} onClick={toggleShuffle}>SHUFFLE</div>
                         <div className={`winamp-toggle ${repeatMode !== 'off' ? 'active' : ''}`} onClick={toggleRepeat}>REPEAT</div>
                    </div>
                    
                    <div style={{flex: 1}}></div>
                    
                    <div style={{display:'flex', alignItems:'center', gap: 5}}>
                         <i className="fas fa-volume-up" style={{fontSize: 10, color: '#ccc'}}></i>
                         <div className="wmp-slider-container" style={{width: 60}}>
                            <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} />
                         </div>
                    </div>
                </div>
            </div>
        ) : (
            /* === STANDARD LAYOUT FOR OTHER THEMES === */
            <>
                <div className="wmp-slider-container">
                    <input 
                        type="range" min="0" max={duration || 100} value={currentTime} 
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setCurrentTime(val);
                            if (mediaRef.current) mediaRef.current.currentTime = val;
                        }}
                    />
                </div>
                
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{fontFamily: (currentTheme === 'winamp5') ? 'Courier New' : 'inherit', fontSize: '12px', minWidth: 80}}>
                    {currentSong ? formatTime(currentTime) : '00:00'} / {currentSong ? formatTime(duration) : '00:00'}
                </div>
                
                <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                    <button className="btn-wmp" onClick={handlePrev} title="Previous"><Icons.Prev/></button>
                    <button className="btn-wmp primary" onClick={togglePlay} title="Play/Pause">
                        {isPlaying ? <Icons.Pause/> : <Icons.Play/>}
                    </button>
                    <button className="btn-wmp" onClick={() => {setIsPlaying(false); setCurrentTime(0); if(mediaRef.current) mediaRef.current.currentTime=0; }} title="Stop"><Icons.Stop/></button>
                    <button className="btn-wmp" onClick={handleNext} title="Next"><Icons.Next/></button>

                    <button className="btn-wmp" onClick={toggleShuffle} title="Shuffle" style={isShuffle ? getActiveBtnStyle() : {}}><Icons.Shuffle/></button>
                    <button className="btn-wmp" onClick={toggleRepeat} title={`Repeat: ${repeatMode}`} style={repeatMode !== 'off' ? getActiveBtnStyle() : {}}>
                        <div style={{position:'relative', display:'flex', alignItems:'center'}}>
                            <Icons.Repeat/>
                            {repeatMode === 'one' && <span style={{position:'absolute', fontSize: '8px', bottom: -2, right: -4, fontWeight: 'bold'}}>1</span>}
                        </div>
                    </button>
                </div>

                <div style={{display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end'}}>
                    <button onClick={toggleMute} style={{background:'none', border:'none', color:'inherit', cursor:'pointer', width: 20}}>{getVolumeIcon(volume)}</button>
                    <div className="wmp-slider-container" style={{width: 80}}>
                        <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} />
                    </div>
                    <button onClick={toggleFullscreen} style={{background:'none', border:'none', color:'inherit', cursor:'pointer', marginLeft: 10}} title="Toggle Fullscreen">
                        {isFullscreen ? <Icons.Compress/> : <Icons.Expand/>}
                    </button>
                </div>
                </div>
                <div style={{textAlign:'center', fontSize: '0.8rem', opacity: 0.8, height: '1.2em', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', fontFamily: (currentTheme==='winamp5') ? 'Courier New' : 'inherit'}}>
                    {currentSong ? `${currentSongIndex + 1}. ${currentSong.name}` : 'Ready'}
                </div>
            </>
        )}
      </div>
    </div>
  );
};

// --- Visualizer Component ---
const VisualizerScreen = ({ 
    mediaRef, currentSong, queue, currentSongIndex, theme,
    onTimeUpdate, onEnded, onFileSelect, onPlayIndex
}: { 
    mediaRef: React.RefObject<HTMLVideoElement>, currentSong: Song | null, queue: Song[], currentSongIndex: number, theme: Theme,
    onTimeUpdate: () => void, onEnded: () => void, onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void, onPlayIndex: (index: number) => void
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const filtersRef = useRef<BiquadFilterNode[]>([]);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showSidebar, setShowSidebar] = useState(false);
    const [showVisualizer, setShowVisualizer] = useState(true);
    const [visualizerMode, setVisualizerMode] = useState(0); 
    const visualizerModeRef = useRef(0);
    const themeRef = useRef(theme);
    
    // Media Error State
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Equalizer State
    const [showEQ, setShowEQ] = useState(false);
    const [eqValues, setEqValues] = useState<number[]>(new Array(10).fill(0));
    const [selectedPreset, setSelectedPreset] = useState<string>('Flat');

    useEffect(() => { visualizerModeRef.current = visualizerMode; }, [visualizerMode]);
    useEffect(() => { themeRef.current = theme; }, [theme]);
    useEffect(() => { if (queue.length > 1) setShowSidebar(true); }, [queue.length]);
    
    // Reset error when song changes
    useEffect(() => {
        setErrorMsg(null);
    }, [currentSong]);

    // Auto-skip on error
    useEffect(() => {
        if (errorMsg && queue.length > 1) {
            const timer = setTimeout(() => {
                onEnded(); // Skip to next song
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [errorMsg]);

    useEffect(() => {
        if (!mediaRef.current || audioContextRef.current) return;
        // Safety check: Don't attach to errored media
        if (mediaRef.current.error) return;

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;

            const source = ctx.createMediaElementSource(mediaRef.current);
            sourceRef.current = source;
            
            // Create EQ Filters
            const filters = EQ_BANDS.map((freq) => {
                const filter = ctx.createBiquadFilter();
                filter.type = 'peaking';
                filter.frequency.value = freq;
                filter.Q.value = 1.4; // Bandwidth
                filter.gain.value = 0;
                return filter;
            });
            filtersRef.current = filters;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512; 
            analyserRef.current = analyser;

            // Connect Chain: Source -> Filter0 -> Filter1 ... -> Analyser -> Destination
            let prevNode: AudioNode = source;
            filters.forEach(f => {
                prevNode.connect(f);
                prevNode = f;
            });
            prevNode.connect(analyser);
            analyser.connect(ctx.destination);

            draw();
        } catch (e) { console.error("Audio Context Error", e); }
    }, []);

    const handleEqChange = (index: number, value: number) => {
        const newValues = [...eqValues];
        newValues[index] = value;
        setEqValues(newValues);
        
        if (filtersRef.current[index]) {
            filtersRef.current[index].gain.value = value;
        }
        setSelectedPreset('Custom');
    };
    
    const handleMediaError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        const err = e.currentTarget.error;
        let msg = "Unknown Error";
        if (err) {
            if (err.code === 4) { // MEDIA_ERR_SRC_NOT_SUPPORTED
                 msg = "Format Not Supported by Browser (Skipping...)";
            } else if (err.code === 3) {
                 msg = "Decode Error (Skipping...)";
            } else if (err.code === 2) {
                 msg = "Network Error";
            } else if (err.code === 1) {
                 msg = "Aborted";
            }
        }
        // Only log warning, don't throw
        console.warn("Media Playback Error:", err?.code, msg);
        setErrorMsg(msg);
    };

    const applyPreset = (presetName: string) => {
        const preset = EQ_PRESETS[presetName];
        if (preset) {
            setEqValues(preset);
            setSelectedPreset(presetName);
            preset.forEach((val, i) => {
                if (filtersRef.current[i]) {
                    filtersRef.current[i].gain.value = val;
                }
            });
        }
    };

    const getPalette = (theme: Theme) => {
        switch(theme) {
            case 'groove': return { start: '#FF4081', mid: '#FF4081', end: '#C2185B', line: '#FF4081' };
            case 'winamp3': return { start: '#FFCC00', mid: '#FF9900', end: '#CC6600', line: '#FFCC00' };
            case 'winamp5':
            case 'winamp_classic': return { start: '#00E000', mid: '#FFFF00', end: '#FF0000', line: '#00E000' };
            case 'jetaudio4': return { start: '#00FFFF', mid: '#0088FF', end: '#0000AA', line: '#00FFFF' };
            case 'xbox': return { start: '#80FF00', mid: '#40C000', end: '#107C10', line: '#80FF00' };
            case 'wmp10': default: return { start: '#7CFC00', mid: '#32CD32', end: '#006400', line: '#ADFF2F' };
        }
    }

    const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const timeArray = new Uint8Array(analyserRef.current.fftSize);

        const render = () => {
            requestAnimationFrame(render);
            const mode = visualizerModeRef.current;
            const currentThemeStr = themeRef.current;
            const currentPalette = getPalette(currentThemeStr);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (currentThemeStr === 'winamp5' || currentThemeStr === 'jetaudio4' || currentThemeStr === 'winamp_classic') {
                ctx.fillStyle = '#000'; ctx.fillRect(0,0, canvas.width, canvas.height);
            }

            if (mode === 0) { // Classic Bars
                analyserRef.current!.getByteFrequencyData(dataArray);
                const barWidth = (canvas.width / bufferLength) * 2.5;
                let x = 0;
                const isWinamp = currentThemeStr === 'winamp5' || currentThemeStr === 'winamp3' || currentThemeStr === 'winamp_classic';

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i];
                    if (isWinamp) {
                        const numBlocks = Math.floor(barHeight / 10);
                        const blockHeight = 8; const gap = 2;
                        for (let j = 0; j < numBlocks; j++) {
                            let color = currentPalette.start;
                            if (j > 16) color = currentPalette.end;
                            else if (j > 10) color = currentPalette.mid;
                            if (currentThemeStr === 'winamp3') color = currentPalette.start;
                            ctx.fillStyle = color;
                            const y = canvas.height - (j * (blockHeight + gap));
                            ctx.fillRect(x, y - blockHeight, barWidth - 1, blockHeight);
                        }
                        if (numBlocks > 0) {
                             ctx.fillStyle = '#FFF';
                             const y = canvas.height - (numBlocks * (blockHeight + gap));
                             ctx.fillRect(x, y - blockHeight - gap, barWidth - 1, blockHeight);
                        }
                    } else {
                        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
                        gradient.addColorStop(0, currentPalette.start); gradient.addColorStop(0.5, currentPalette.mid); gradient.addColorStop(1, currentPalette.end);
                        ctx.fillStyle = gradient;
                        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                    }
                    x += barWidth + 1;
                }
            } else if (mode === 1) { // 3D Mirror
                analyserRef.current!.getByteFrequencyData(dataArray);
                const barWidth = (canvas.width / bufferLength) * 3;
                let x = 0; const midY = canvas.height / 2 + 50;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] * 0.8;
                    ctx.fillStyle = currentPalette.start;
                    ctx.fillRect(x, midY - barHeight, barWidth, barHeight);
                    ctx.fillStyle = `rgba(255,255,255,0.2)`;
                    ctx.fillRect(x, midY, barWidth, barHeight * 0.6);
                    x += barWidth + 1;
                }
                ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(canvas.width, midY); ctx.stroke();
            } else if (mode === 2) { // Circular
                analyserRef.current!.getByteFrequencyData(dataArray);
                const centerX = canvas.width / 2; const centerY = canvas.height / 2; const radius = 50;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] * 0.8;
                    const rad = (i / bufferLength) * 2 * Math.PI;
                    const xStart = centerX + Math.cos(rad) * radius; const yStart = centerY + Math.sin(rad) * radius;
                    const xEnd = centerX + Math.cos(rad) * (radius + barHeight); const yEnd = centerY + Math.sin(rad) * (radius + barHeight);
                    ctx.strokeStyle = currentPalette.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xStart, yStart); ctx.lineTo(xEnd, yEnd); ctx.stroke();
                }
            } else if (mode === 3) { // Waveform
                analyserRef.current!.getByteTimeDomainData(timeArray);
                ctx.lineWidth = currentThemeStr === 'jetaudio4' ? 1 : 2; ctx.strokeStyle = currentPalette.line; ctx.beginPath();
                const sliceWidth = canvas.width / timeArray.length; let x = 0;
                for (let i = 0; i < timeArray.length; i++) {
                    const v = timeArray[i] / 128.0; const y = v * canvas.height / 2;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    x += sliceWidth;
                }
                ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();
            }
        };
        render();
    };

    return (
        <div style={{width: '100%', height: '100%', position: 'relative', display: 'flex'}}>
            <div style={{flex: 1, position: 'relative', height: '100%'}}>
                 <video 
                    ref={mediaRef} 
                    style={{width: '100%', height: '100%', objectFit: 'contain', display: (currentSong?.type === 'video' && !errorMsg) ? 'block' : 'none', position: 'absolute', zIndex: 10}} 
                    onTimeUpdate={onTimeUpdate} 
                    onEnded={onEnded} 
                    onError={handleMediaError}
                 />
                 <canvas ref={canvasRef} width={800} height={500} style={{width: '100%', height: '100%', display: showVisualizer && (currentSong?.type !== 'video' || errorMsg) ? 'block' : 'none', position: 'absolute', zIndex: 5}} />
                 
                 {errorMsg && (
                     <div style={{width:'100%', height:'100%', position:'absolute', zIndex: 25, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color: '#ff4444', background: 'rgba(0,0,0,0.8)', textAlign:'center', padding:20}}>
                         <Icons.Exclamation />
                         <div style={{marginTop: 10, fontWeight: 'bold', fontSize: '1.2em'}}>Playback Failed</div>
                         <div style={{fontSize: 14, opacity: 0.8, marginTop: 5}}>{errorMsg}</div>
                         <div style={{fontSize: 11, opacity: 0.5, marginTop: 15, maxWidth: 300}}>
                             Browsers do not support .wmv, .avi, or .flv.
                             <br/>Skipping to next track...
                         </div>
                     </div>
                 )}

                 {!showVisualizer && currentSong?.type !== 'video' && !errorMsg && (
                     <div style={{width:'100%', height:'100%', background: (theme === 'winamp5' || theme === 'winamp_classic') ? '#000' : 'transparent', display: 'flex', alignItems:'center', justifyContent:'center', color: '#333'}}>
                        <i className="fas fa-music" style={{fontSize: 100, opacity: 0.2, color: (theme === 'winamp5' || theme === 'winamp_classic') ? '#0f0' : 'inherit'}}></i>
                     </div>
                 )}
                 {!currentSong && (
                    <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex: 20}}>
                        <button className="center-btn" onClick={() => fileInputRef.current?.click()} style={{padding: '10px 20px', fontSize: '1.2rem', cursor: 'pointer'}}><Icons.Folder /> Open Media</button>
                    </div>
                 )}
                 
                 {/* Visualizer Controls - Grouped */}
                 <div className="toggle-bar">
                    <button className="overlay-btn" onClick={() => fileInputRef.current?.click()} title="Open File"><Icons.Folder /></button>
                    <button className={`overlay-toggle-btn ${showVisualizer ? 'active' : ''}`} onClick={() => setShowVisualizer(!showVisualizer)} title="Toggle Visualizer"><Icons.Eye/></button>
                    <button className="overlay-toggle-btn" onClick={() => setVisualizerMode((prev) => (prev + 1) % 4)} title="Change Visualization"><Icons.Palette/></button>
                    <button className={`overlay-toggle-btn ${showEQ ? 'active' : ''}`} onClick={() => setShowEQ(!showEQ)} title="Equalizer"><Icons.Sliders/></button>
                    <button className={`overlay-toggle-btn ${showSidebar ? 'active' : ''}`} onClick={() => setShowSidebar(!showSidebar)} title="Toggle Playlist"><Icons.List/></button>
                 </div>

                 {/* Equalizer Panel Overlay */}
                 {showEQ && (
                    <div className="eq-panel">
                        <div className="eq-header">
                            <span>Equalizer</span>
                            <button onClick={() => setShowEQ(false)}><Icons.Times/></button>
                        </div>
                        <div className="eq-presets">
                            <label>Preset:</label>
                            <select value={selectedPreset} onChange={(e) => applyPreset(e.target.value)}>
                                <option value="Custom">Custom</option>
                                {Object.keys(EQ_PRESETS).map(key => (
                                    <option key={key} value={key}>{key}</option>
                                ))}
                            </select>
                        </div>
                        <div className="eq-sliders-container">
                            {EQ_BANDS.map((freq, i) => (
                                <div key={i} className="eq-band">
                                    <div className="eq-slider-wrapper">
                                        <input 
                                            type="range" 
                                            min="-12" max="12" step="0.5"
                                            value={eqValues[i]}
                                            onChange={(e) => handleEqChange(i, parseFloat(e.target.value))}
                                            className="eq-range"
                                        />
                                    </div>
                                    <div className="eq-label">{freq >= 1000 ? (freq/1000) + 'K' : freq}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}

                 <input type="file" multiple accept={ACCEPTED_FILES} ref={fileInputRef} style={{display: 'none'}} onChange={onFileSelect} />
            </div>
            {showSidebar && (
                <div className="now-playing-sidebar">
                    <div className="np-header">Now Playing ({queue.length})</div>
                    <div className="np-list">
                        {queue.map((s, i) => (
                            <div key={i} className={`np-item ${i === currentSongIndex ? 'active' : ''}`} onDoubleClick={() => onPlayIndex(i)}>
                                <div className="np-item-icon">{i === currentSongIndex && <i className="fas fa-volume-up"></i>}</div>
                                <span>{i + 1}. {s.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const PlaylistManager = ({ playlists, setPlaylists, onPlayPlaylist, currentQueueId, theme }: { playlists: Playlist[], setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>, onPlayPlaylist: (id: string) => void, currentQueueId: string | null, theme: Theme }) => {
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(playlists[0]?.id || '');
    const [isCreating, setIsCreating] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const activePlaylist = playlists.find(p => p.id === selectedPlaylistId);

    const handleCreateSubmit = () => {
        if (newPlaylistName.trim()) {
             const newPl: Playlist = { id: Math.random().toString(36).substr(2, 9), name: newPlaylistName, songs: [] };
            setPlaylists([...playlists, newPl]); setSelectedPlaylistId(newPl.id); setNewPlaylistName(""); setIsCreating(false);
        } else { setIsCreating(false); }
    }
    const deletePlaylist = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Delete this playlist?")) {
            const newPls = playlists.filter(p => p.id !== id); setPlaylists(newPls);
            if (selectedPlaylistId === id && newPls.length > 0) setSelectedPlaylistId(newPls[0].id);
        }
    };
    const addToPlaylist = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !activePlaylist) return;
        const files: File[] = Array.from(e.target.files);
        const newSongs: Song[] = files.map(file => ({ 
            id: Math.random().toString(36).substr(2, 9), 
            name: file.name, 
            file: file, 
            url: URL.createObjectURL(file), 
            type: getMediaType(file)
        }));
        const updatedPlaylists = playlists.map(p => { if (p.id === selectedPlaylistId) return { ...p, songs: [...p.songs, ...newSongs] }; return p; });
        setPlaylists(updatedPlaylists); e.target.value = '';
    };
    const removeFromPlaylist = (songId: string) => {
        const updatedPlaylists = playlists.map(p => { if (p.id === selectedPlaylistId) return { ...p, songs: p.songs.filter(s => s.id !== songId) }; return p; });
        setPlaylists(updatedPlaylists);
    };

    return (
        <div style={{display: 'flex', width: '100%', height: '100%'}}>
            <div className="wmp-sidebar">
                <div className="sidebar-header">All Playlists</div>
                <div className="sidebar-content">
                    {playlists.map(pl => (
                        <div key={pl.id} className={`sidebar-item ${pl.id === selectedPlaylistId ? 'selected' : ''}`} onClick={() => setSelectedPlaylistId(pl.id)}>
                            <i className="fas fa-list-ul" style={{marginRight: 8}}></i><span style={{flex: 1, overflow:'hidden', textOverflow:'ellipsis'}}>{pl.name}</span>
                            <span className="delete-btn" onClick={(e) => deletePlaylist(e, pl.id)}><i className="fas fa-times"></i></span>
                        </div>
                    ))}
                    {isCreating ? (
                         <div className="sidebar-item" style={{background: 'rgba(255,255,255,0.1)'}}>
                             <input autoFocus value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') handleCreateSubmit(); if(e.key === 'Escape') setIsCreating(false); }} onBlur={handleCreateSubmit} placeholder="Name..." style={{width: '80%', background:'transparent', border:'none', color:'inherit', outline:'none'}} />
                         </div>
                    ) : (
                        <div className="sidebar-item add-btn" onClick={() => setIsCreating(true)}><i className="fas fa-plus-circle" style={{marginRight: 8}}></i> Create Playlist</div>
                    )}
                </div>
            </div>
            <div className="wmp-playlist-content">
                {activePlaylist ? (
                    <>
                        <div className="playlist-toolbar">
                            <div style={{fontWeight: 'bold', fontSize: '1.2rem'}}>{activePlaylist.name}</div>
                            <div style={{display: 'flex', gap: 10}}>
                                <button className="btn-small" onClick={() => fileInputRef.current?.click()}><Icons.Plus/> Add Files</button>
                                <button className="btn-small primary" onClick={() => onPlayPlaylist(activePlaylist.id)}><Icons.Play/> Play List</button>
                            </div>
                            <input type="file" multiple ref={fileInputRef} style={{display: 'none'}} accept={ACCEPTED_FILES} onChange={addToPlaylist} />
                        </div>
                        <div className="wmp-list-view">
                             <div className="wmp-list-header"><div style={{width: '50%'}}>Name</div><div style={{width: '30%'}}>Type</div><div style={{width: '20%', textAlign: 'right'}}>Action</div></div>
                             <div className="wmp-list-body">
                                 {activePlaylist.songs.length === 0 && <div style={{padding: 20, textAlign: 'center', opacity: 0.6}}>Playlist is empty. Add some files!</div>}
                                 {activePlaylist.songs.map((song, i) => (
                                     <div key={i} className="wmp-list-row">
                                         <div style={{width: '50%'}}>{song.name}</div><div style={{width: '30%'}}>{song.type.toUpperCase()}</div>
                                         <div style={{width: '20%', textAlign: 'right'}}><button className="btn-icon danger" onClick={() => removeFromPlaylist(song.id)}><Icons.Trash/></button></div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </>
                ) : ( <div style={{flex: 1, display: 'flex', alignItems:'center', justifyContent:'center', opacity: 0.6}}>Select a playlist to manage</div> )}
            </div>
        </div>
    );
};

// Safe DOM mounting
const mountApp = () => {
    const rootEl = document.getElementById('root');
    if (rootEl) {
        const root = createRoot(rootEl);
        root.render(<App />);
    } else {
        console.error("Root element not found, retrying...");
        setTimeout(mountApp, 100);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountApp);
} else {
    mountApp();
}
