import { create } from 'zustand';
import { Audio } from 'expo-av';
import { supabase } from '../utils/supabase';
import { resolveTrackUri, downloadTrack, deleteCachedTrack, getCachedSongIds } from '../utils/cacheHelper';
import { playSpotifyTrack, pauseSpotify } from '../utils/spotify';

export const usePlayerStore = create((set, get) => {
  let positionInterval = null;

  const startPositionTicker = (soundInstance) => {
    if (positionInterval) clearInterval(positionInterval);

    positionInterval = setInterval(async () => {
      try {
        const status = await soundInstance.getStatusAsync();
        if (status.isLoaded) {
          set({
            position: status.positionMillis,
            duration: status.durationMillis || 0,
          });

          if (status.didJustFinish) {
            get().playNext();
          }
        }
      } catch (e) {
        // ignore
      }
    }, 500);
  };

  const stopPositionTicker = () => {
    if (positionInterval) {
      clearInterval(positionInterval);
      positionInterval = null;
    }
  };

  // Mock position ticker for Spotify playback simulation
  let spotifyInterval = null;
  const startSpotifyTicker = () => {
    if (spotifyInterval) clearInterval(spotifyInterval);
    spotifyInterval = setInterval(() => {
      const { position, duration, isPlaying } = get();
      if (isPlaying && position < duration) {
        set({ position: position + 1000 });
      }
    }, 1000);
  };

  const stopSpotifyTicker = () => {
    if (spotifyInterval) {
      clearInterval(spotifyInterval);
      spotifyInterval = null;
    }
  };

  return {
    sound: null,
    isPlaying: false,
    currentTrack: null,
    playlist: [],
    playlistIndex: -1,
    position: 0,
    duration: 0,
    lyrics: [],
    cachedSongIds: new Set(),
    
    // Spotify integration state
    spotifyToken: null,
    visualizerPreset: 'CHILL WAVE',

    setSpotifyToken: (token) => {
      set({ spotifyToken: token });
      if (typeof window !== 'undefined' && window.localStorage) {
        if (token) {
          window.localStorage.setItem('spotify_token', token);
        } else {
          window.localStorage.removeItem('spotify_token');
        }
      }
    },
    setVisualizerPreset: (preset) => set({ visualizerPreset: preset }),

    // Load list of locally downloaded song IDs
    loadCachedRegistry: async () => {
      const list = await getCachedSongIds();
      set({ cachedSongIds: new Set(list) });
    },

    // Download/delete local track cache
    toggleDownloadTrack: async (track) => {
      const { cachedSongIds } = get();
      const isDownloaded = cachedSongIds.has(track.id.toString());
      const updated = new Set(cachedSongIds);

      if (isDownloaded) {
        await deleteCachedTrack(track.id.toString());
        updated.delete(track.id.toString());
      } else {
        const res = await downloadTrack(track.id.toString(), track.file_url);
        if (res) {
          updated.add(track.id.toString());
        }
      }
      set({ cachedSongIds: updated });
    },

    playTrack: async (track, queue = []) => {
      const { sound: currentSound, spotifyToken } = get();
      
      // Stop active local audio
      if (currentSound) {
        stopPositionTicker();
        await currentSound.unloadAsync().catch(() => {});
      }
      stopSpotifyTicker();

      set({
        position: 0,
        duration: track.duration_ms || 200 * 1000, // Default duration if not from Spotify API
        isPlaying: false,
        lyrics: [],
      });

      // Update active playlist queue references
      if (queue.length > 0) {
        set({
          playlist: queue,
          playlistIndex: queue.findIndex(t => t.id === track.id),
        });
      }

      // Branch 1: If track contains a Spotify URI and token is linked, play via Spotify Connect REST
      if (spotifyToken && track.uri) {
        try {
          await playSpotifyTrack(track.uri, spotifyToken);
          set({
            sound: null,
            isPlaying: true,
            currentTrack: track,
          });
          startSpotifyTicker();
          return;
        } catch (e) {
          console.log("Spotify playback request error", e);
        }
      }

      // Branch 2: Standard Expo-AV local file stream
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldRouteThroughEarpieceAndroid: false,
        });

        const playableUri = await resolveTrackUri(track.id.toString(), track.file_url);
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: playableUri },
          { shouldPlay: true }
        );

        set({
          sound: newSound,
          isPlaying: true,
          currentTrack: track,
        });

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            set({ isPlaying: status.isPlaying });
          }
        });

        startPositionTicker(newSound);
        get().loadLyrics(track.id.toString());
      } catch (e) {
        console.log("Local playback error", e);
      }
    },

    togglePlay: async () => {
      const { sound, isPlaying, spotifyToken, currentTrack } = get();

      // If playing Spotify track, toggle via Spotify Connect REST
      if (spotifyToken && currentTrack?.uri) {
        if (isPlaying) {
          await pauseSpotify(spotifyToken);
          set({ isPlaying: false });
          stopSpotifyTicker();
        } else {
          await playSpotifyTrack(currentTrack.uri, spotifyToken);
          set({ isPlaying: true });
          startSpotifyTicker();
        }
        return;
      }

      // Otherwise, toggle standard Expo-AV audio
      if (!sound) return;

      if (isPlaying) {
        await sound.pauseAsync();
        stopPositionTicker();
        set({ isPlaying: false });
      } else {
        await sound.playAsync();
        startPositionTicker(sound);
        set({ isPlaying: true });
      }
    },

    playNext: () => {
      const { playlist, playlistIndex } = get();
      if (playlistIndex !== -1 && playlistIndex + 1 < playlist.length) {
        get().playTrack(playlist[playlistIndex + 1], playlist);
      }
    },

    playPrev: () => {
      const { playlist, playlistIndex } = get();
      if (playlistIndex > 0) {
        get().playTrack(playlist[playlistIndex - 1], playlist);
      }
    },

    seek: async (posMs) => {
      const { sound, spotifyToken } = get();
      if (spotifyToken) {
        set({ position: posMs });
        return;
      }
      if (!sound) return;
      await sound.setPositionAsync(posMs);
      set({ position: posMs });
    },

    removeFromPlaylist: (trackId) => {
      const { playlist, playlistIndex, currentTrack } = get();
      const updated = playlist.filter(t => t.id.toString() !== trackId.toString());
      const newIndex = updated.findIndex(t => t.id === currentTrack?.id);
      set({ playlist: updated, playlistIndex: newIndex });
    },

    addToPlaylist: (track) => {
      const { playlist } = get();
      if (!playlist.some(t => t.id === track.id)) {
        set({ playlist: [...playlist, track] });
      }
    },

    // Load synchronized scrolling lyrics from Supabase
    loadLyrics: async (songId) => {
      try {
        const { data, error } = await supabase
          .from('lyrics')
          .select('lines')
          .eq('song_id', songId)
          .maybeSingle();

        if (data && data.lines) {
          set({ lyrics: data.lines });
        }
      } catch (e) {
        console.log("Error loading lyrics", e);
      }
    },
  };
});
