import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Image, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../utils/supabase';
import { usePlayerStore } from '../store/usePlayerStore';
import MusicStories from '../components/MusicStories';
import { Audio } from 'expo-av';
import { playClickSFX, playCoinSFX } from '../utils/sfxHelper';

export default function HomeScreen({ navigation }) {
  const playTrack = usePlayerStore(state => state.playTrack);
  const sound = usePlayerStore(state => state.sound);
  const coins = usePlayerStore(state => state.coins);
  const addCoins = usePlayerStore(state => state.addCoins);

  const [userId, setUserId] = useState(null);
  const [browseSongs, setBrowseSongs] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavoritesLoading, setIsFavoritesLoading] = useState(true);

  // Dynamic theme accent
  const [themeColor, setThemeColor] = useState('#ff00ff');

  // Jam Session Modal
  const [jamModalVisible, setJamModalVisible] = useState(false);
  const [roomCode, setRoomCode] = useState('');

  // Song Snaps states
  const [snaps, setSnaps] = useState([]);
  const [activeSnap, setActiveSnap] = useState(null);
  const [snapPlayerVisible, setSnapPlayerVisible] = useState(false);
  const [snapProgress, setSnapProgress] = useState(1);
  const [snapSound, setSnapSound] = useState(null);

  const snapTimer = useRef(null);
  const snapProgressTimer = useRef(null);

  // Pomodoro Study Timer states
  const [pomoTimeLeft, setPomoTimeLeft] = useState(25 * 60);
  const [pomoActive, setPomoActive] = useState(false);
  const [pomoMode, setPomoMode] = useState('STUDY'); // 'STUDY', 'BREAK'
  const timerInterval = useRef(null);

  useEffect(() => {
    const initData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          fetchFavorites(user.id);
          fetchThemeColor(user.id);
        }
      } catch (e) {
        console.log("Auth session retrieve error in Home", e);
      }
      fetchBrowseSongs();
      fetchSongSnaps();
    };
    initData();
  }, []);

  useEffect(() => {
    if (pomoActive) {
      timerInterval.current = setInterval(() => {
        setPomoTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval.current);
            handlePomoComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerInterval.current) clearInterval(timerInterval.current);
    }

    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [pomoActive, pomoMode]);

  const handlePomoComplete = () => {
    setPomoActive(false);
    playCoinSFX();

    if (pomoMode === 'STUDY') {
      addCoins(50);
      setPomoMode('BREAK');
      setPomoTimeLeft(5 * 60);
      Alert.alert("[!] STUDY SESSION COMPLETE", "LEVEL UP! You earned 50 retro coins! Grab some water and take a 5-minute break.");
    } else {
      setPomoMode('STUDY');
      setPomoTimeLeft(25 * 60);
      Alert.alert("[!] BREAK OVER", "Let's get back to gaming and focus. 25-minute timer start!");
    }
  };

  const togglePomoTimer = () => {
    playClickSFX();
    setPomoActive(!pomoActive);
  };

  const resetPomoTimer = () => {
    playClickSFX();
    setPomoActive(false);
    setPomoMode('STUDY');
    setPomoTimeLeft(25 * 60);
  };

  const formatPomoTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const fetchThemeColor = async (uid) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('theme_color')
        .eq('id', uid)
        .maybeSingle();
      if (data) {
        setThemeColor(data.theme_color);
      }
    } catch (e) {
      console.log(e);
    }
  };

  const fetchBrowseSongs = async () => {
    try {
      const { data, error } = await supabase.from('songs').select('*').limit(5);
      if (error) throw error;
      setBrowseSongs(data || []);
    } catch (e) {
      console.log("Error loading songs", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFavorites = async (uid) => {
    if (!uid) return;
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('*')
        .eq('userId', uid);
      if (error) throw error;
      
      const favs = (data || []).map(item => ({
        id: item.songId,
        title: item.title || 'Unknown',
        author: item.author || 'Unknown',
        cover_url: item.cover_url,
        file_url: item.file_url,
      }));
      setFavorites(favs);
    } catch (e) {
      console.log("Error loading favorites", e);
    } finally {
      setIsFavoritesLoading(false);
    }
  };

  const fetchSongSnaps = async () => {
    try {
      const { data, error } = await supabase
        .from('song_snaps')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSnaps(data || []);
    } catch (e) {
      console.log("Error loading snaps", e);
    }
  };

  const handleOpenSnap = async (snap) => {
    playClickSFX();
    setActiveSnap(snap);
    setSnapProgress(1);
    setSnapPlayerVisible(true);

    try {
      if (snapSound) {
        await snapSound.unloadAsync();
      }
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: snap.file_url },
        { shouldPlay: true }
      );
      setSnapSound(newSound);

      let elapsed = 0;
      snapProgressTimer.current = setInterval(() => {
        elapsed += 100;
        setSnapProgress(1 - (elapsed / 5000));
      }, 100);

      snapTimer.current = setTimeout(async () => {
        await handleCloseAndDestroySnap(snap, newSound);
      }, 5000);

    } catch (e) {
      console.log("Snap play error", e);
    }
  };

  const handleCloseAndDestroySnap = async (snap, activeSoundInstance) => {
    clearInterval(snapProgressTimer.current);
    clearTimeout(snapTimer.current);

    const soundToStop = activeSoundInstance || snapSound;
    if (soundToStop) {
      await soundToStop.stopAsync().catch(() => {});
      await soundToStop.unloadAsync().catch(() => {});
      setSnapSound(null);
    }

    setSnapPlayerVisible(false);
    setActiveSnap(null);

    try {
      await supabase.from('song_snaps').delete().eq('id', snap.id);
      fetchSongSnaps();
    } catch (e) {
      console.log("Error deleting snap", e);
    }
  };

  const handleCreateJam = async () => {
    if (!userId) return;
    const randomCode = (1000 + Math.floor(Math.random() * 9000)).toString();

    let fileUrl = '';
    if (sound) {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        fileUrl = status.uri || '';
      }
    }

    try {
      const { error } = await supabase.from('jams').insert({
        code: randomCode,
        hostId: userId,
        isPlaying: false,
        positionMs: 0,
        file_url: fileUrl,
        title: 'Active Session',
        author: 'Host Lobby',
        cover_url: null,
      });
      if (error) throw error;

      setJamModalVisible(false);
      navigation.navigate('JamLobby', { roomCode: randomCode, isHost: true });
    } catch (e) {
      Alert.alert("Error", "Could not create lobby: " + e.message);
    }
  };

  const handleJoinJam = async () => {
    const code = roomCode.trim();
    if (code.length !== 4) {
      Alert.alert("Input Error", "Please enter a valid 4-digit code.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('jams')
        .select('*')
        .eq('code', code)
        .maybeSingle();
      if (error) throw error;

      if (data) {
        setJamModalVisible(false);
        setRoomCode('');
        navigation.navigate('JamLobby', { roomCode: code, isHost: false });
      } else {
        Alert.alert("Error", "Lobby not found. Check code.");
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const renderSongRow = ({ item }, queue) => (
    <TouchableOpacity style={styles.songRow} onPress={() => playTrack(item, queue)}>
      <Image
        source={{ uri: item.cover_url || 'https://picsum.photos/id/1025/100/100' }}
        style={styles.rowCover}
      />
      <View style={styles.rowMeta}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title.toUpperCase()}</Text>
        <Text style={styles.rowAuthor} numberOfLines={1}>{item.author.toUpperCase()}</Text>
      </View>
      <View style={styles.playIconContainer}>
        <Image source={require('../../assets/play_button.png')} style={styles.rowPlayIcon} />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.logoRow}>
        <Image source={require('../../assets/titleSprite.png')} style={styles.logoImage} resizeMode="contain" />
        <View style={[styles.coinIndicator, { borderColor: themeColor }]}>
          <Text style={[styles.coinText, { color: themeColor }]}>🪙 {coins} COINS</Text>
        </View>
      </View>

      {/* Stories Section */}
      <View style={styles.sectionHeaderRow}>
        <Image source={require('../../assets/music_note.png')} style={styles.headerIcon} />
        <Text style={styles.sectionHeader}>DAILY VIBE STORIES</Text>
      </View>
      <MusicStories />

      {/* Chiptune Pomodoro Study Timer Card */}
      <View style={[styles.pomoCard, { borderColor: themeColor }]}>
        <View style={styles.pomoHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={require('../../assets/music_note.png')} style={[styles.headerIcon, { tintColor: themeColor }]} />
            <Text style={styles.pomoTitle}>FOCUS SESSION</Text>
          </View>
          <Text style={[styles.pomoBadge, { color: themeColor, borderColor: themeColor, backgroundColor: `${themeColor}15` }]}>
            {pomoMode}
          </Text>
        </View>
        <Text style={[styles.pomoTimerText, { textShadowColor: themeColor }]}>{formatPomoTime(pomoTimeLeft)}</Text>
        <View style={styles.pomoActionRow}>
          <TouchableOpacity onPress={togglePomoTimer} style={[styles.pomoBtn, { backgroundColor: themeColor, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <Image source={require('../../assets/play_button.png')} style={[styles.btnPlayIcon, { tintColor: '#000000' }]} />
            <Text style={styles.pomoBtnText}>{pomoActive ? 'PAUSE FOCUS' : 'START FOCUS'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={resetPomoTimer} style={styles.pomoResetBtn}>
            <Text style={styles.pomoResetText}>RESET</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Disappearing Song Snaps Feed */}
      {snaps.length > 0 && (
        <View style={styles.snapsFeedSection}>
          <View style={styles.sectionHeaderRow}>
            <Image source={require('../../assets/music_note.png')} style={styles.headerIcon} />
            <Text style={styles.sectionHeader}>UNOPENED SONG SNAPS</Text>
          </View>
          <FlatList
            horizontal
            data={snaps}
            keyExtractor={item => item.id.toString()}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.snapCard} onPress={() => handleOpenSnap(item)}>
                <View style={styles.snapRing}>
                  <Image source={{ uri: item.cover_url || 'https://picsum.photos/id/1025/50/50' }} style={styles.snapCover} />
                </View>
                <Text style={styles.snapSender}>{item.sender}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Discover Section */}
      <View style={styles.sectionHeaderRow}>
        <Image source={require('../../assets/music_note.png')} style={styles.headerIcon} />
        <Text style={styles.sectionHeader}>DISCOVER TRACKS</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator size="small" color={themeColor} style={styles.loader} />
      ) : (
        <FlatList
          data={browseSongs}
          renderItem={(data) => renderSongRow(data, browseSongs)}
          keyExtractor={item => item.id.toString()}
          scrollEnabled={false}
        />
      )}

      {/* Pixel Blend Trigger Card */}
      <TouchableOpacity style={styles.blendCard} onPress={() => navigation.navigate('PixelBlend')}>
        <Image source={require('../../assets/connect_icon.png')} style={styles.blendIcon} />
        <Text style={styles.blendText}>COMPATIBILITY PIXEL BLEND</Text>
      </TouchableOpacity>

      {/* Favorites Section */}
      <View style={styles.sectionHeaderRow}>
        <Image source={require('../../assets/music_note.png')} style={styles.headerIcon} />
        <Text style={styles.sectionHeader}>YOUR FAVORITE SOUNDS</Text>
      </View>
      {isFavoritesLoading ? (
        <ActivityIndicator size="small" color={themeColor} style={styles.loader} />
      ) : favorites.length === 0 ? (
        <View style={styles.emptyFavs}>
          <Text style={styles.emptyFavsText}>NO FAVORITES YET</Text>
          <Text style={styles.emptyFavsSub}>HEART SONGS ON THE SEARCH TAB TO ADD</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={(data) => renderSongRow(data, favorites)}
          keyExtractor={item => item.id.toString()}
          scrollEnabled={false}
        />
      )}

      {/* Jam Lobby Trigger Button */}
      <TouchableOpacity style={[styles.jamBtn, { backgroundColor: themeColor }]} onPress={() => setJamModalVisible(true)}>
        <Image source={require('../../assets/jam_icon.png')} style={styles.jamIcon} />
        <Text style={styles.jamBtnText}>CREATE / JOIN PARTY JAM</Text>
      </TouchableOpacity>

      {/* Jam Input Dialog Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={jamModalVisible}
        onRequestClose={() => setJamModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>PARTY JAM SESSION</Text>
            <TouchableOpacity style={[styles.modalCreateBtn, { backgroundColor: themeColor }]} onPress={handleCreateJam}>
              <Text style={styles.modalCreateText}>CREATE NEW LOBBY</Text>
            </TouchableOpacity>

            <Text style={styles.modalOr}>OR JOIN LOBBY BY CODE</Text>
            <TextInput
              placeholder="CODE"
              placeholderTextColor="grey"
              keyboardType="number-pad"
              maxLength={4}
              value={roomCode}
              onChangeText={setRoomCode}
              style={styles.modalInput}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setJamModalVisible(false)}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleJoinJam}>
                <Text style={[styles.joinText, { color: themeColor }]}>JOIN ROOM</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Disappearing Song Snap Player Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={snapPlayerVisible}
        onRequestClose={() => handleCloseAndDestroySnap(activeSnap)}
      >
        {activeSnap && (
          <View style={styles.snapOverlay}>
            <View style={styles.snapProgressContainer}>
              <View style={[styles.snapProgressFill, { width: `${snapProgress * 100}%` }]} />
            </View>

            <TouchableOpacity style={styles.snapCloseBtn} onPress={() => handleCloseAndDestroySnap(activeSnap)}>
              <Text style={styles.snapCloseText}>✕ CLOSE</Text>
            </TouchableOpacity>

            <View style={styles.snapPlayerContent}>
              <Image source={{ uri: activeSnap.cover_url }} style={styles.snapPlayerCover} />
              
              <View style={styles.snapMsgBubble}>
                <Text style={styles.snapMsgSender}>{activeSnap.sender}:</Text>
                <Text style={styles.snapMsgText}>{activeSnap.message.toUpperCase()}</Text>
              </View>

              <Text style={styles.snapPlayerTitle}>[#] {activeSnap.title.toUpperCase()}</Text>
              <Text style={styles.snapNotice}>[!] THIS SNAP DESTROYS UPON CLOSING</Text>
            </View>
          </View>
        )}
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 150,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 20,
  },
  logoImage: {
    width: 140,
    height: 44,
  },
  coinIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    height: 28,
    alignSelf: 'center',
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  coinText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  headerIcon: {
    width: 12,
    height: 12,
    marginRight: 8,
    resizeMode: 'contain',
    tintColor: 'grey',
  },
  sectionHeader: {
    color: 'grey',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  loader: {
    marginVertical: 16,
  },
  pomoCard: {
    backgroundColor: '#0d0d0d',
    borderRadius: 16,
    padding: 24,
    marginVertical: 12,
    borderWidth: 2,
    shadowColor: '#ff00ff',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  pomoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pomoTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  pomoBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 1,
  },
  pomoTimerText: {
    color: '#ffffff',
    fontSize: 56,
    fontWeight: '900',
    textAlign: 'center',
    marginVertical: 16,
    letterSpacing: 3,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  pomoActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    alignItems: 'center',
  },
  pomoBtn: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  btnPlayIcon: {
    width: 10,
    height: 10,
    resizeMode: 'contain',
  },
  pomoBtnText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  pomoResetBtn: {
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  pomoResetText: {
    color: 'grey',
    fontSize: 11,
    fontWeight: 'bold',
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 12,
    borderRadius: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  rowCover: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  rowMeta: {
    flex: 1,
    marginLeft: 14,
  },
  rowTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  rowAuthor: {
    color: 'grey',
    fontSize: 12,
    marginTop: 2,
  },
  playIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPlayIcon: {
    width: 10,
    height: 10,
    resizeMode: 'contain',
    tintColor: '#ff00ff',
  },
  blendCard: {
    height: 52,
    backgroundColor: '#0d0d0d',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#00e5ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    shadowColor: '#00e5ff',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  blendIcon: {
    width: 14,
    height: 14,
    marginRight: 8,
    resizeMode: 'contain',
    tintColor: '#00e5ff',
  },
  blendText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  emptyFavs: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  emptyFavsText: {
    color: 'grey',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyFavsSub: {
    color: 'grey',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  jamBtn: {
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    flexDirection: 'row',
    gap: 8,
  },
  jamIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    tintColor: '#000000',
  },
  jamBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
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
    borderColor: '#ff00ff',
  },
  modalTitle: {
    color: '#ff00ff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    letterSpacing: 1.5,
  },
  modalCreateBtn: {
    height: 48,
    width: '100%',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCreateText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  modalOr: {
    color: 'grey',
    fontSize: 10,
    marginVertical: 16,
    fontWeight: 'bold',
  },
  modalInput: {
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.06)',
    width: '100%',
    borderRadius: 8,
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 18,
    letterSpacing: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
    paddingHorizontal: 8,
  },
  cancelText: {
    color: 'grey',
    fontSize: 13,
  },
  joinText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  snapsFeedSection: {
    marginVertical: 12,
  },
  snapCard: {
    alignItems: 'center',
    marginRight: 16,
  },
  snapRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#ffd700',
    padding: 2,
  },
  snapCover: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  snapSender: {
    color: 'grey',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 6,
  },
  snapOverlay: {
    flex: 1,
    backgroundColor: '#050505',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  snapProgressContainer: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  snapProgressFill: {
    height: '100%',
    backgroundColor: '#ffd700',
  },
  snapCloseBtn: {
    alignSelf: 'flex-end',
    marginTop: 16,
    padding: 8,
  },
  snapCloseText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  snapPlayerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  snapPlayerCover: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  snapMsgBubble: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderWidth: 1,
    borderColor: '#ffd700',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 32,
    width: '100%',
  },
  snapMsgSender: {
    color: '#ffd700',
    fontWeight: 'bold',
    fontSize: 11,
    marginBottom: 4,
  },
  snapMsgText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  snapPlayerTitle: {
    color: '#b3b3b3',
    fontWeight: 'bold',
    fontSize: 13,
    marginTop: 24,
  },
  snapNotice: {
    color: 'grey',
    fontSize: 9,
    marginTop: 40,
    letterSpacing: 1,
  },
});
