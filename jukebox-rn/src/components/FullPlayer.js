import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, FlatList, Animated, Modal, TextInput, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePlayerStore } from '../store/usePlayerStore';
import { supabase } from '../utils/supabase';
import PixelVisualizer from './PixelVisualizer';
import { playClickSFX, playCoinSFX } from '../utils/sfxHelper';

const { width, height } = Dimensions.get('window');
const EQ_PRESETS = ['CHILL WAVE', 'BASS BOOST', 'GLITCH POP'];

export default function FullPlayer({ onClose }) {
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const togglePlay = usePlayerStore(state => state.togglePlay);
  const playNext = usePlayerStore(state => state.playNext);
  const playPrev = usePlayerStore(state => state.playPrev);
  const playlist = usePlayerStore(state => state.playlist);
  const playlistIndex = usePlayerStore(state => state.playlistIndex);
  const position = usePlayerStore(state => state.position);
  const duration = usePlayerStore(state => state.duration);
  const seek = usePlayerStore(state => state.seek);
  
  const lyrics = usePlayerStore(state => state.lyrics);
  const cachedSongIds = usePlayerStore(state => state.cachedSongIds);
  const toggleDownloadTrack = usePlayerStore(state => state.toggleDownloadTrack);
  const visualizerPreset = usePlayerStore(state => state.visualizerPreset);
  const setVisualizerPreset = usePlayerStore(state => state.setVisualizerPreset);
  const removeFromPlaylist = usePlayerStore(state => state.removeFromPlaylist);

  // 3-way toggle: 'COVER', 'LYRICS', 'QUEUE'
  const [playerViewMode, setPlayerViewMode] = useState('COVER');
  const [projectorModeActive, setProjectorModeActive] = useState(false);

  const [snapModalVisible, setSnapModalVisible] = useState(false);
  const [snapMessage, setSnapMessage] = useState('');
  const [isSendingSnap, setIsSendingSnap] = useState(false);

  const flatListRef = useRef(null);
  const projectorListRef = useRef(null);

  if (!currentTrack) return null;

  const hasNext = playlistIndex !== -1 && playlistIndex + 1 < playlist.length;
  const hasPrevious = playlistIndex > 0;
  const isDownloaded = cachedSongIds.has(currentTrack.id.toString());
  const progress = duration > 0 ? position / duration : 0;

  const upcomingQueue = playlistIndex !== -1 ? playlist.slice(playlistIndex + 1) : [];

  const activeLyricIndex = lyrics.findIndex((line, index) => {
    const nextLine = lyrics[index + 1];
    return position >= line.timeMs && (!nextLine || position < nextLine.timeMs);
  });

  const triggerHaptic = async (style = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      if (Haptics && Haptics.impactAsync) {
        await Haptics.impactAsync(style);
      }
    } catch (e) {
      // Ignored
    }
  };

  useEffect(() => {
    if (flatListRef.current && activeLyricIndex !== -1 && playerViewMode === 'LYRICS') {
      try {
        flatListRef.current.scrollToIndex({
          index: activeLyricIndex,
          animated: true,
          viewPosition: 0.5,
        });
      } catch (e) {
        // Ignored
      }
    }
    if (projectorListRef.current && activeLyricIndex !== -1 && projectorModeActive) {
      try {
        projectorListRef.current.scrollToIndex({
          index: activeLyricIndex,
          animated: true,
          viewPosition: 0.5,
        });
      } catch (e) {
        // Ignored
      }
    }
  }, [activeLyricIndex, playerViewMode, projectorModeActive]);

  const formatTime = (ms) => {
    if (isNaN(ms) || ms <= 0) return '00:00';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressBarPress = (event) => {
    const { locationX } = event.nativeEvent;
    const barWidth = width - 48;
    const seekPercentage = locationX / barWidth;
    const seekPosition = seekPercentage * duration;
    seek(seekPosition);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSendSnap = async () => {
    if (!snapMessage.trim()) return;
    setIsSendingSnap(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const senderName = user?.email ? user.email.split('@')[0].toUpperCase() : 'ANONYMOUS';

      const { error } = await supabase.from('song_snaps').insert({
        sender: senderName,
        songId: currentTrack.id.toString(),
        title: currentTrack.title,
        cover_url: currentTrack.cover_url,
        file_url: currentTrack.file_url,
        message: snapMessage.trim(),
      });
      if (error) throw error;

      playCoinSFX();
      setSnapMessage('');
      setSnapModalVisible(false);
      Alert.alert("Sent!", "Your song snap was sent successfully!");
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setIsSendingSnap(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with 3 view tabs */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backText}>◀</Text>
        </TouchableOpacity>
        
        <View style={styles.headerTabRow}>
          <TouchableOpacity onPress={() => { setPlayerViewMode('COVER'); playClickSFX(); triggerHaptic(); }}>
            <Text style={[styles.headerTabText, { color: playerViewMode === 'COVER' ? '#ff00ff' : 'grey' }]}>DISC</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setPlayerViewMode('LYRICS'); playClickSFX(); triggerHaptic(); }}>
            <Text style={[styles.headerTabText, { color: playerViewMode === 'LYRICS' ? '#ff00ff' : 'grey' }]}>LYRICS</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setPlayerViewMode('QUEUE'); playClickSFX(); triggerHaptic(); }}>
            <Text style={[styles.headerTabText, { color: playerViewMode === 'QUEUE' ? '#ff00ff' : 'grey' }]}>QUEUE</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerSpacer} />
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {playerViewMode === 'COVER' && (
          <View style={styles.albumArtContainer}>
            <Image
              source={{ uri: currentTrack.cover_url || 'https://picsum.photos/id/1025/300/300' }}
              style={styles.cover}
            />
          </View>
        )}

        {playerViewMode === 'LYRICS' && (
          <View style={styles.lyricsContainer}>
            {lyrics.length === 0 ? (
              <View style={styles.emptyLyrics}>
                <Text style={styles.emptyLyricsText}>NO LYRICS AVAILABLE</Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={lyrics}
                keyExtractor={(item, index) => index.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.lyricsListContent}
                onScrollToIndexFailed={() => {}}
                renderItem={({ item, index }) => {
                  const isActive = index === activeLyricIndex;
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        seek(item.timeMs);
                        playClickSFX();
                        triggerHaptic();
                      }}
                    >
                      <Text
                        style={[
                          styles.lyricLine,
                          {
                            color: isActive ? '#ff00ff' : 'grey',
                            fontSize: isActive ? 22 : 16,
                            fontWeight: isActive ? 'bold' : 'normal',
                            textAlign: 'center',
                          },
                        ]}
                      >
                        {item.text}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        )}

        {playerViewMode === 'QUEUE' && (
          <View style={styles.queueContainer}>
            <Text style={styles.queueHeader}>UP NEXT</Text>
            {upcomingQueue.length === 0 ? (
              <View style={styles.emptyQueue}>
                <Text style={styles.emptyQueueText}>QUEUE IS EMPTY</Text>
                <Text style={styles.emptyQueueSub}>ADD MORE FROM HOME OR SEARCH</Text>
              </View>
            ) : (
              <FlatList
                data={upcomingQueue}
                keyExtractor={(item, index) => index.toString()}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.queueRow}>
                    <Image source={{ uri: item.cover_url }} style={styles.queueCover} />
                    <View style={styles.queueMeta}>
                      <Text style={styles.queueTitle} numberOfLines={1}>{item.title.toUpperCase()}</Text>
                      <Text style={styles.queueAuthor} numberOfLines={1}>{item.author.toUpperCase()}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        removeFromPlaylist(item.id);
                        playClickSFX();
                        triggerHaptic();
                      }}
                      style={styles.removeQueueBtn}
                    >
                      <Text style={styles.removeQueueText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        )}
      </View>

      {/* Interactive Visualizer Presets selector drawer */}
      <View style={styles.eqRow}>
        {EQ_PRESETS.map((preset) => {
          const isActive = visualizerPreset === preset;
          const label = preset === 'CHILL WAVE' ? '〰️ CHILL WAVE' : preset === 'BASS BOOST' ? '🔊 BASS BOOST' : '⚡ GLITCH POP';
          return (
            <TouchableOpacity
              key={preset}
              onPress={() => {
                setVisualizerPreset(preset);
                playClickSFX();
                triggerHaptic();
              }}
              style={[
                styles.eqBtn,
                {
                  borderColor: isActive ? '#ff00ff' : 'rgba(255,255,255,0.1)',
                  backgroundColor: isActive ? 'rgba(255, 0, 255, 0.08)' : 'transparent',
                  shadowColor: isActive ? '#ff00ff' : 'transparent',
                  shadowOpacity: isActive ? 0.4 : 0,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 0 }
                }
              ]}
            >
              <Text style={[styles.eqBtnText, { color: isActive ? '#ff00ff' : 'grey' }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Retro Pixel Visualizer */}
      <View style={styles.visualizerContainer}>
        <PixelVisualizer />
      </View>

      {/* Meta Area with Download and Snap Buttons */}
      <View style={styles.metaRow}>
        <View style={styles.metaText}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title.toUpperCase()}
          </Text>
          <Text style={styles.author} numberOfLines={1}>
            {currentTrack.author.toUpperCase()}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => {
              setProjectorModeActive(true);
              playClickSFX();
              triggerHaptic();
            }}
            style={styles.projectorBtn}
          >
            <Text style={styles.projectorText}>📺 PROJECTOR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setSnapModalVisible(true);
              playClickSFX();
              triggerHaptic();
            }}
            style={styles.snapBtn}
          >
            <Text style={styles.snapBtnText}>📸 SNAP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              toggleDownloadTrack(currentTrack);
              playClickSFX();
              triggerHaptic();
            }}
            style={styles.downloadBtn}
          >
            <Text style={[styles.downloadIcon, { color: isDownloaded ? '#ff00ff' : 'grey' }]}>
              {isDownloaded ? '✓ CACHED' : '⬇ DOWNLOAD'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Custom Progress Bar */}
      <View style={styles.progressContainer}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.progressBarBackground}
          onPress={handleProgressBarPress}
        >
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </TouchableOpacity>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Playback Controls */}
      <View style={styles.controlRow}>
        <TouchableOpacity
          onPress={() => {
            playPrev();
            playClickSFX();
            triggerHaptic();
          }}
          disabled={!hasPrevious}
          style={[styles.navBtn, { opacity: hasPrevious ? 1 : 0.3 }]}
        >
          <Text style={styles.navText}>◀◀</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            togglePlay();
            playClickSFX();
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
          }}
          style={styles.playBtn}
        >
          <Text style={styles.playText}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            playNext();
            playClickSFX();
            triggerHaptic();
          }}
          disabled={!hasNext}
          style={[styles.navBtn, { opacity: hasNext ? 1 : 0.3 }]}
        >
          <Text style={styles.navText}>▶▶</Text>
        </TouchableOpacity>
      </View>

      {/* Fullscreen Landscape Projector Mode Modal overlay */}
      <Modal
        visible={projectorModeActive}
        transparent={false}
        animationType="fade"
        supportedOrientations={['landscape', 'portrait']}
      >
        <SafeAreaView style={styles.projectorBg}>
          <View style={styles.projectorHeader}>
            <Text style={styles.projectorTitle}>JUKEBOX AMBIENT THEATRE</Text>
            <TouchableOpacity onPress={() => setProjectorModeActive(false)} style={styles.projectorCloseBtn}>
              <Text style={styles.projectorCloseText}>✕ EXIT PROJECTOR</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.projectorBody}>
            {/* Spinning Neon vinyl disc art */}
            <View style={styles.projectorArtContainer}>
              <Image source={{ uri: currentTrack.cover_url }} style={styles.projectorCover} />
              <Text style={styles.projectorTrackTitle}>{currentTrack.title.toUpperCase()}</Text>
              <Text style={styles.projectorTrackAuthor}>{currentTrack.author.toUpperCase()}</Text>
            </View>

            {/* Giant center visualizer blocks */}
            <View style={styles.projectorVisualizerWrap}>
              <PixelVisualizer />
            </View>

            {/* Oversized scrollable lyrics list */}
            <View style={styles.projectorLyricsWrap}>
              {lyrics.length === 0 ? (
                <Text style={styles.noProjectorLyrics}>INSTRUMENTAL PLAYBACK</Text>
              ) : (
                <FlatList
                  ref={projectorListRef}
                  data={lyrics}
                  keyExtractor={(item, index) => index.toString()}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.projectorLyricsScrollContent}
                  renderItem={({ item, index }) => {
                    const isActive = index === activeLyricIndex;
                    return (
                      <Text
                        style={[
                          styles.projectorLyricLine,
                          {
                            color: isActive ? '#ff00ff' : 'grey',
                            fontSize: isActive ? 24 : 16,
                            fontWeight: isActive ? 'bold' : 'normal',
                          },
                        ]}
                      >
                        {item.text}
                      </Text>
                    );
                  }}
                />
              )}
            </View>
          </View>

          {/* Simple controls */}
          <View style={styles.projectorControls}>
            <TouchableOpacity onPress={togglePlay} style={styles.projectorPlayBtn}>
              <Text style={styles.projectorPlayText}>{isPlaying ? '⏸ PAUSE' : '▶ PLAY'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Song Snap Composer Modal Dialog */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={snapModalVisible}
        onRequestClose={() => setSnapModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📸 CREATE SONG SNAP</Text>
            <Text style={styles.modalSubtitle}>Write a chiptune status note overlay:</Text>
            <TextInput
              placeholder="E.g., VIBING OUT TO THIS BEAT..."
              placeholderTextColor="grey"
              value={snapMessage}
              onChangeText={setSnapMessage}
              style={styles.modalInput}
              maxLength={60}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setSnapModalVisible(false)}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendSnap} disabled={isSendingSnap}>
                <Text style={styles.sendText}>SEND SNAP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  backBtn: {
    padding: 8,
  },
  backText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTabRow: {
    flexDirection: 'row',
    gap: 16,
  },
  headerTabText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  headerSpacer: {
    width: 28,
  },
  mainContent: {
    height: height * 0.4,
    justifyContent: 'center',
    marginVertical: 10,
  },
  albumArtContainer: {
    alignItems: 'center',
  },
  cover: {
    width: width * 0.68,
    height: width * 0.68,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#ff00ff',
  },
  lyricsContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  lyricsListContent: {
    paddingVertical: height * 0.15,
  },
  lyricLine: {
    paddingVertical: 12,
    lineHeight: 28,
  },
  emptyLyrics: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLyricsText: {
    color: 'grey',
    fontWeight: 'bold',
  },
  queueContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  queueHeader: {
    color: '#ff00ff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 12,
  },
  emptyQueue: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyQueueText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyQueueSub: {
    color: 'grey',
    fontSize: 11,
    marginTop: 4,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  queueCover: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  queueMeta: {
    flex: 1,
    marginLeft: 12,
  },
  queueTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  queueAuthor: {
    color: 'grey',
    fontSize: 11,
    marginTop: 1,
  },
  removeQueueBtn: {
    padding: 8,
  },
  removeQueueText: {
    color: '#ff4d4d',
    fontSize: 16,
    fontWeight: 'bold',
  },
  eqRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 8,
  },
  eqBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  eqBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  visualizerContainer: {
    height: 60,
    marginBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metaText: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  author: {
    color: '#b3b3b3',
    fontSize: 14,
    marginTop: 2,
  },
  snapBtn: {
    backgroundColor: '#ffd700',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  snapBtnText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  projectorBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  projectorText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  downloadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  downloadIcon: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBarBackground: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2.5,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ff00ff',
    borderRadius: 2.5,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    color: '#b3b3b3',
    fontSize: 12,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginVertical: 5,
  },
  navBtn: {
    padding: 16,
  },
  navText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ff00ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff00ff',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  playText: {
    color: '#000000',
    fontSize: 28,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#0d0d0d',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  modalTitle: {
    color: '#ffd700',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalSubtitle: {
    color: 'grey',
    fontSize: 12,
    marginBottom: 16,
  },
  modalInput: {
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.06)',
    width: '100%',
    borderRadius: 8,
    color: '#ffffff',
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  cancelText: {
    color: 'grey',
    fontSize: 14,
  },
  sendText: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  projectorBg: {
    flex: 1,
    backgroundColor: '#050505',
    paddingHorizontal: 32,
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  projectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectorTitle: {
    color: '#ff00ff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  projectorCloseBtn: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#ff4d4d',
    borderRadius: 6,
  },
  projectorCloseText: {
    color: '#ff4d4d',
    fontSize: 11,
    fontWeight: 'bold',
  },
  projectorBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginVertical: 12,
  },
  projectorArtContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectorCover: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: '#ff00ff',
  },
  projectorTrackTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
  projectorTrackAuthor: {
    color: 'grey',
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
  },
  projectorVisualizerWrap: {
    flex: 1.2,
    height: '60%',
    justifyContent: 'center',
  },
  projectorLyricsWrap: {
    flex: 1.5,
    height: '80%',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  noProjectorLyrics: {
    color: 'grey',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 60,
    fontWeight: 'bold',
  },
  projectorLyricsScrollContent: {
    paddingVertical: 40,
  },
  projectorLyricLine: {
    paddingVertical: 10,
    textAlign: 'center',
  },
  projectorControls: {
    alignItems: 'center',
    marginBottom: 10,
  },
  projectorPlayBtn: {
    backgroundColor: '#ff00ff',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 10,
  },
  projectorPlayText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
