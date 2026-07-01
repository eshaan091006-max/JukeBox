import { create } from 'zustand';
import { Audio } from 'expo-av';
import { supabase } from '../utils/supabase';
import { resolveTrackUri, downloadTrack, deleteCachedTrack, getCachedSongIds } from '../utils/cacheHelper';

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
      const { sound: currentSound } = get();
      if (currentSound) {
        stopPositionTicker();
        await currentSound.unloadAsync();
      }

      set({
        position: 0,
        duration: 0,
        isPlaying: false,
        lyrics: [],
      });

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldRouteThroughEarpieceAndroid: false,
        });

        // 1. Resolve cached playing URI
        const playableUri = await resolveTrackUri(track.id.toString(), track.file_url);

        // 2. Initialize expo-av sound
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: playableUri },
          { shouldPlay: true }
        );

        set({
          sound: newSound,
          isPlaying: true,
          currentTrack: track,
        });

        if (queue.length > 0) {
          set({
            playlist: queue,
            playlistIndex: queue.findIndex(t => t.id === track.id),
          });
        }

        // Hook listener callbacks
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            set({ isPlaying: status.isPlaying });
          }
        });

        startPositionTicker(newSound);
        get().loadLyrics(track.id.toString());
      } catch (e) {
        console.log("Playback error", e);
      }
    },

    togglePlay: async () => {
      const { sound, isPlaying } = get();
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
      const { sound } = get();
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
          // data.lines is a JSON array of { timeMs, text }
          set({ lyrics: data.lines });
        }
      } catch (e) {
        console.log("Error loading lyrics", e);
      }
    },
  };
});
