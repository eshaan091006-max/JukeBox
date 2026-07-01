import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, ScrollView, FlatList, SafeAreaView, KeyboardAvoidingView, Platform, Alert, Animated, Modal, Share } from 'react-native';
import { supabase } from '../utils/supabase';
import { usePlayerStore } from '../store/usePlayerStore';
import { Audio } from 'expo-av';
import { playCoinSFX, playErrorSFX, playClickSFX } from '../utils/sfxHelper';

const triviaQuestions = [
  {
    songUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    correctAnswer: "8-BIT RETRO FUN",
    options: ["PIXEL CASTLE", "8-BIT RETRO FUN", "CYBERPUNK DRIVE", "SPACE INVASION"]
  },
  {
    songUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    correctAnswer: "PIXEL CASTLE",
    options: ["CHIPTUNE ROCKS", "CYBERPUNK DRIVE", "PIXEL CASTLE", "8-BIT RETRO FUN"]
  }
];

export default function JamLobbyScreen({ route, navigation }) {
  const { roomCode, isHost } = route.params;
  
  // Zustand audio store hooks
  const playTrack = usePlayerStore(state => state.playTrack);
  const sound = usePlayerStore(state => state.sound);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const position = usePlayerStore(state => state.position);

  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [lobbyData, setLobbyData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  // Collaborative Queue states
  const [jamQueue, setJamQueue] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [upvotedQueueIds, setUpvotedQueueIds] = useState(new Set());

  // Invite Modal
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  // Multiplayer Trivia states
  const [leaderboard, setLeaderboard] = useState([]);
  const [triviaSound, setTriviaSound] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);

  const isSyncing = useRef(false);
  const playTimeout = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || 'Anonymous');
      }
    };
    fetchUser();
  }, []);

  // 1. Sync from Supabase jams table changes
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data, error } = await supabase
          .from('jams')
          .select('*')
          .eq('code', roomCode)
          .maybeSingle();
        if (data) {
          setLobbyData(data);
        }
      } catch (e) {
        console.log(e);
      }
    };
    fetchInitialData();

    const channel = supabase
      .channel(`jam:${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jams', filter: `code=eq.${roomCode}` },
        async (payload) => {
          const data = payload.new;
          if (!data || Object.keys(data).length === 0) {
            if (!isHost) {
              Alert.alert("Lobby Closed", "The host has closed this session.");
              navigation.navigate('Tabs');
            }
            return;
          }
          setLobbyData(data);

          if (!isHost) {
            await syncGuestPlayer(data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, sound]);

  // 2. Playback Sync triggers
  useEffect(() => {
    if (!isHost || !sound) return;
    supabase
      .from('jams')
      .update({ isPlaying: isPlaying })
      .eq('code', roomCode)
      .catch(e => console.log(e));
  }, [isPlaying]);

  useEffect(() => {
    if (!isHost || !sound) return;

    const currentSec = Math.floor(position / 1000);
    if (currentSec > 0 && currentSec % 5 === 0) {
      supabase
        .from('jams')
        .update({ positionMs: position })
        .eq('code', roomCode)
        .catch(e => console.log(e));
    }
  }, [position]);

  const syncGuestPlayer = async (data) => {
    if (isSyncing.current || !sound) return;
    isSyncing.current = true;

    const remotePlaying = data.isPlaying || false;
    const remotePositionMs = data.positionMs || 0;

    try {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      if (remotePlaying && !status.isPlaying) {
        await sound.playAsync();
      } else if (!remotePlaying && status.isPlaying) {
        await sound.pauseAsync();
      }

      if (Math.abs(status.positionMillis - remotePositionMs) > 3000) {
        await sound.setPositionAsync(remotePositionMs);
      }
    } catch (e) {
      console.log("Guest sync error", e);
    } finally {
      isSyncing.current = false;
    }
  };

  // 3. Collaborative Lobby Queue Listener
  useEffect(() => {
    const fetchJamQueue = async () => {
      const { data } = await supabase
        .from('jam_queues')
        .select('*')
        .eq('roomCode', roomCode)
        .order('votes', { ascending: false })
        .order('created_at', { ascending: true });
      if (data) setJamQueue(data);
    };
    fetchJamQueue();

    const channel = supabase
      .channel(`jam_queue:${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jam_queues', filter: `roomCode=eq.${roomCode}` },
        () => {
          fetchJamQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  // 4. Messages & Leaderboard Live Feed
  useEffect(() => {
    const fetchInitialMessages = async () => {
      const { data } = await supabase
        .from('jam_messages')
        .select('*')
        .eq('roomCode', roomCode)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setMessages(data);
    };
    fetchInitialMessages();

    const channel = supabase
      .channel(`messages:${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'jam_messages', filter: `roomCode=eq.${roomCode}` },
        (payload) => {
          setMessages(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  // Live scoreboard sync
  useEffect(() => {
    if (!lobbyData?.triviaActive) return;

    const fetchScoreboard = async () => {
      const { data } = await supabase
        .from('jam_trivia_players')
        .select('*')
        .eq('roomCode', roomCode)
        .order('score', { ascending: false });
      if (data) setLeaderboard(data);
    };
    fetchScoreboard();

    const channel = supabase
      .channel(`scores:${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jam_trivia_players', filter: `roomCode=eq.${roomCode}` },
        () => {
          fetchScoreboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyData?.triviaActive, roomCode]);

  // Local Trivia Playback for snippet preview
  useEffect(() => {
    const playSnippet = async () => {
      if (lobbyData?.triviaActive && lobbyData?.triviaQuestionIdx !== undefined) {
        setIsAnswered(false);
        setSelectedAnswer(null);
        setIsCorrect(false);

        const question = triviaQuestions[lobbyData.triviaQuestionIdx];
        if (triviaSound) {
          await triviaSound.unloadAsync();
        }

        try {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: question.songUrl },
            { shouldPlay: true }
          );
          setTriviaSound(newSound);

          playTimeout.current = setTimeout(async () => {
            if (newSound) {
              await newSound.stopAsync();
            }
          }, 5000);
        } catch (e) {
          console.log(e);
        }
      } else {
        clearTimeout(playTimeout.current);
        if (triviaSound) {
          await triviaSound.unloadAsync();
          setTriviaSound(null);
        }
      }
    };
    playSnippet();

    return () => {
      clearTimeout(playTimeout.current);
      if (triviaSound) {
        triviaSound.unloadAsync();
      }
    };
  }, [lobbyData?.triviaActive, lobbyData?.triviaQuestionIdx]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || !userId) return;
    setInputText('');

    const sender = isHost ? "Host" : "Guest";

    try {
      await supabase.from('jam_messages').insert({
        roomCode: roomCode,
        sender,
        text,
      });
    } catch (e) {
      console.log("Error sending message", e);
    }
  };

  const handleSearchSongs = async (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .ilike('title', `%${text}%`);
      setSearchResults(data || []);
    } catch (e) {
      console.log(e);
    }
  };

  const handleAddSongToJamQueue = async (song) => {
    playClickSFX();
    try {
      const { error } = await supabase.from('jam_queues').insert({
        roomCode: roomCode,
        songId: song.id.toString(),
        title: song.title,
        author: song.author,
        cover_url: song.cover_url,
        file_url: song.file_url,
        votes: 1,
        added_by: userEmail.split('@')[0].toUpperCase(),
      });

      if (error) throw error;
      setShowSearchModal(false);
      setSearchQuery('');
      setSearchResults([]);
      Alert.alert("Success", "Song added to Jam queue!");
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const handleUpvoteQueueItem = async (item) => {
    if (upvotedQueueIds.has(item.id)) return;
    playCoinSFX();

    const updated = new Set(upvotedQueueIds);
    updated.add(item.id);
    setUpvotedQueueIds(updated);

    try {
      await supabase
        .from('jam_queues')
        .update({ votes: item.votes + 1 })
        .eq('id', item.id);
    } catch (e) {
      console.log(e);
    }
  };

  const handleStartTrivia = async () => {
    playClickSFX();
    try {
      await supabase.from('jam_trivia_players').delete().eq('roomCode', roomCode);
      const qIdx = Math.floor(Math.random() * triviaQuestions.length);
      await supabase
        .from('jams')
        .update({
          triviaActive: true,
          triviaQuestionIdx: qIdx,
        })
        .eq('code', roomCode);
    } catch (e) {
      console.log(e);
    }
  };

  const handleCloseTrivia = async () => {
    playClickSFX();
    try {
      await supabase
        .from('jams')
        .update({ triviaActive: false })
        .eq('code', roomCode);
    } catch (e) {
      console.log(e);
    }
  };

  const handleTriviaAnswer = async (answer) => {
    if (isAnswered || !userId) return;
    setIsAnswered(true);
    setSelectedAnswer(answer);

    const question = triviaQuestions[lobbyData.triviaQuestionIdx];
    const correct = answer === question.correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      playCoinSFX();
    } else {
      playErrorSFX();
    }

    try {
      await supabase
        .from('jam_trivia_players')
        .upsert({
          roomCode: roomCode,
          userId: userId,
          sender: userEmail.split('@')[0].toUpperCase(),
          score: correct ? 10 : 0,
        }, { onConflict: 'roomCode,userId' });
    } catch (e) {
      console.log("Leaderboard update error", e);
    }
  };

  const handleLeaveLobby = async () => {
    playClickSFX();
    if (isHost) {
      try {
        await supabase.from('jams').delete().eq('code', roomCode);
        await supabase.from('jam_queues').delete().eq('roomCode', roomCode);
      } catch (e) {
        console.log("Error clearing lobby", e);
      }
    }
    navigation.navigate('Tabs');
  };

  const handleShareInvite = async () => {
    playClickSFX();
    try {
      await Share.share({
        message: `👾 JOIN MY JUKEBOX PARTY LOBBY! 👾\nRoom Code: ${roomCode}\nLink: https://jukebox-aux.party/join?room=${roomCode}`,
      });
    } catch (e) {
      console.log(e);
    }
  };

  const title = lobbyData?.title || 'NO SONG PLAYING';
  const author = lobbyData?.author || 'Add songs to queue';
  const coverUrl = lobbyData?.cover_url;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>JAM SESSION</Text>
          <TouchableOpacity onPress={handleLeaveLobby} style={styles.exitBtn}>
            <Text style={styles.exitText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Room code banner (Tap to Share Invite modal) */}
        <TouchableOpacity style={styles.codeBanner} onPress={() => { playClickSFX(); setInviteModalVisible(true); }}>
          <Text style={styles.bannerLabel}>ROOM CODE (TAP FOR AUX QR)</Text>
          <Text style={styles.bannerCode}>{roomCode}</Text>
        </TouchableOpacity>

        {/* Live Multiplayer Trivia Overlay */}
        {lobbyData?.triviaActive ? (
          <View style={styles.triviaCard}>
            <View style={styles.triviaCardHeader}>
              <Text style={styles.triviaTitle}>🏆 MULTIPLAYER TRIVIA DUEL 🏆</Text>
              {isHost && (
                <TouchableOpacity onPress={handleCloseTrivia} style={styles.closeTriviaBtn}>
                  <Text style={styles.closeTriviaText}>✕ CLOSE</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.triviaSub}>Listen to the snippet! Guess the correct cover:</Text>

            <View style={styles.triviaOptions}>
              {triviaQuestions[lobbyData.triviaQuestionIdx].options.map((option, idx) => {
                const isSelected = selectedAnswer === option;
                const isCorrectOption = option === triviaQuestions[lobbyData.triviaQuestionIdx].correctAnswer;

                let bg = 'rgba(255,255,255,0.08)';
                if (isAnswered) {
                  if (isCorrectOption) bg = '#ff00ff';
                  else if (isSelected) bg = '#ff4d4d';
                }

                return (
                  <TouchableOpacity
                    key={idx}
                    disabled={isAnswered}
                    style={[styles.triviaOptBtn, { backgroundColor: bg }]}
                    onPress={() => handleTriviaAnswer(option)}
                  >
                    <Text style={[styles.triviaOptText, { color: isAnswered && (isCorrectOption || isSelected) ? '#000000' : '#ffffff' }]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.leaderboardTitle}>LIVE DUEL STANDINGS</Text>
            <View style={styles.leaderboardBox}>
              {leaderboard.length === 0 ? (
                <Text style={styles.emptyLeaderboard}>WAITING FOR ANSWERS...</Text>
              ) : (
                leaderboard.map((player, index) => (
                  <View key={index} style={styles.leaderboardRow}>
                    <Text style={styles.playerRank}>{index + 1}. {player.sender}</Text>
                    <Text style={styles.playerScore}>{player.score} PTS</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : (
          <View style={styles.lobbyMainView}>
            {/* Left Column: Playing Song + Shared Playlist Queue */}
            <View style={styles.leftCol}>
              <Text style={styles.sectionHeader}>COLLABORATIVE PLAYLIST</Text>
              <TouchableOpacity style={styles.addQueueItemBtn} onPress={() => setShowSearchModal(true)}>
                <Text style={styles.addQueueItemText}>➕ SUGGEST SONG</Text>
              </TouchableOpacity>

              {jamQueue.length === 0 ? (
                <View style={styles.emptyQueue}>
                  <Text style={styles.emptyQueueText}>PLAYLIST IS EMPTY</Text>
                  <Text style={styles.emptyQueueSub}>TAP BUTTON TO ADD</Text>
                </View>
              ) : (
                <FlatList
                  data={jamQueue}
                  keyExtractor={item => item.id.toString()}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const hasVoted = upvotedQueueIds.has(item.id);
                    return (
                      <View style={styles.queueRow}>
                        <Image source={{ uri: item.cover_url }} style={styles.queueCover} />
                        <View style={styles.queueMeta}>
                          <Text style={styles.queueTitle} numberOfLines={1}>{item.title.toUpperCase()}</Text>
                          <Text style={styles.queueAuthor} numberOfLines={1}>BY {item.added_by}</Text>
                        </View>
                        <TouchableOpacity 
                          disabled={hasVoted}
                          onPress={() => handleUpvoteQueueItem(item)} 
                          style={[styles.upvoteBtn, { opacity: hasVoted ? 0.4 : 1 }]}
                        >
                          <Text style={styles.upvoteIcon}>👍 {item.votes}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                />
              )}
            </View>

            {/* Right Column: Snapchat Chat Feed */}
            <View style={styles.rightCol}>
              <Text style={styles.sectionHeader}>DISAPPEARING CHAT</Text>
              <View style={styles.chatBox}>
                <FlatList
                  inverted
                  data={messages}
                  keyExtractor={item => item.id.toString()}
                  renderItem={({ item }) => (
                    <DisappearingMessage text={item.text} sender={item.sender} />
                  )}
                />
              </View>

              {isHost && (
                <TouchableOpacity onPress={handleStartTrivia} style={styles.startTriviaBtn}>
                  <Text style={styles.startTriviaText}>🎮 START TRIVIA</Text>
                </TouchableOpacity>
              )}

              <View style={styles.inputRow}>
                <TextInput
                  placeholder="SEND MESSAGE..."
                  placeholderTextColor="grey"
                  value={inputText}
                  onChangeText={setInputText}
                  style={styles.input}
                  onSubmitEditing={handleSendMessage}
                />
                <TouchableOpacity onPress={handleSendMessage} style={styles.sendBtn}>
                  <Text style={styles.sendIcon}>▶</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Simulated Retro QR Invite Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={inviteModalVisible}
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.inviteCard}>
            <Text style={styles.inviteHeader}>👾 SCAN TO JOIN PARTY LOBBY 👾</Text>
            
            {/* Simulated 8-bit visual QR code grid */}
            <View style={styles.qrGridContainer}>
              <Text style={styles.qrRowChar}>█■█■█■█■█■█■█■█■█■█</Text>
              <Text style={styles.qrRowChar}>■█  █■■  ■█■■  █■■█</Text>
              <Text style={styles.qrRowChar}>█■ █■■██■■█■  █■ █■</Text>
              <Text style={styles.qrRowChar}>■██■   █■■   ██■■██</Text>
              <Text style={styles.qrRowChar}>█■  ██■■██■■██   █■</Text>
              <Text style={styles.qrRowChar}>█■█■█■█■█■█■█■█■█■█</Text>
            </View>

            <Text style={styles.inviteCodeLabel}>LOBBY ROOM CODE: {roomCode}</Text>

            <View style={styles.inviteActions}>
              <TouchableOpacity onPress={handleShareInvite} style={styles.inviteShareBtn}>
                <Text style={styles.inviteShareText}>INVITE FRIENDS</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)} style={styles.inviteCloseBtn}>
                <Text style={styles.inviteCloseText}>✕ CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Song search modal overlay for collaborative queues */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSearchModal}
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.searchModalContent}>
            <Text style={styles.searchModalTitle}>SUGGEST SONG</Text>
            
            <TextInput
              placeholder="SEARCH CATALOG SONGS..."
              placeholderTextColor="grey"
              value={searchQuery}
              onChangeText={handleSearchSongs}
              style={styles.searchInput}
            />

            <FlatList
              data={searchResults}
              keyExtractor={item => item.id.toString()}
              style={styles.searchResultsList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => handleAddSongToJamQueue(item)}>
                  <Image source={{ uri: item.cover_url }} style={styles.resultCover} />
                  <View style={styles.resultMeta}>
                    <Text style={styles.resultTitle}>{item.title.toUpperCase()}</Text>
                    <Text style={styles.resultAuthor}>{item.author.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.addIcon}>➕</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity style={styles.closeSearchBtn} onPress={() => setShowSearchModal(false)}>
              <Text style={styles.closeSearchText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Disappearing message bubble component
function DisappearingMessage({ text, sender }) {
  const [opacity] = useState(new Animated.Value(1.0));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 2000,
        useNativeDriver: false,
      }).start();
    }, 8000);

    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 10000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.msgContainer, { opacity }]}>
      <Text style={styles.msgText}>
        <Text style={styles.msgSender}>{sender}: </Text>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  exitBtn: {
    padding: 8,
  },
  exitText: {
    color: '#ff4d4d',
    fontSize: 24,
  },
  codeBanner: {
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ff00ff',
    borderRadius: 8,
    paddingVertical: 12,
    marginVertical: 12,
  },
  bannerLabel: {
    color: 'grey',
    fontSize: 10,
  },
  bannerCode: {
    color: '#ff00ff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  roleText: {
    color: 'grey',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  songCard: {
    alignItems: 'center',
    marginBottom: 12,
  },
  cover: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  songTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  songAuthor: {
    color: 'grey',
    fontSize: 13,
  },
  lobbyMainView: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  leftCol: {
    flex: 1.1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  rightCol: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionHeader: {
    color: 'grey',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  addQueueItemBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  addQueueItemText: {
    color: '#ff00ff',
    fontWeight: 'bold',
    fontSize: 10,
  },
  emptyQueue: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyQueueText: {
    color: 'grey',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyQueueSub: {
    color: 'grey',
    fontSize: 9,
    marginTop: 2,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  queueCover: {
    width: 32,
    height: 32,
    borderRadius: 2,
  },
  queueMeta: {
    flex: 1,
    marginLeft: 8,
  },
  queueTitle: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  queueAuthor: {
    color: 'grey',
    fontSize: 9,
  },
  upvoteBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  upvoteIcon: {
    color: '#ff00ff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chatBox: {
    height: 280, // Fixed height to prevent visual container expansion leaks
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 10,
    color: '#ffffff',
    fontSize: 12,
  },
  sendBtn: {
    marginLeft: 8,
  },
  sendIcon: {
    color: '#ff00ff',
    fontSize: 18,
  },
  msgContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginVertical: 2,
  },
  msgText: {
    color: '#ffffff',
    fontSize: 11,
  },
  msgSender: {
    fontWeight: 'bold',
    color: '#ff00ff',
  },
  startTriviaBtn: {
    backgroundColor: '#ffd700',
    borderRadius: 6,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  startTriviaText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 11,
  },
  triviaCard: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  triviaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  triviaTitle: {
    color: '#ffd700',
    fontWeight: 'bold',
    fontSize: 14,
  },
  closeTriviaBtn: {
    padding: 6,
    borderWidth: 1,
    borderColor: '#ff4d4d',
    borderRadius: 4,
  },
  closeTriviaText: {
    color: '#ff4d4d',
    fontSize: 10,
    fontWeight: 'bold',
  },
  triviaSub: {
    color: 'grey',
    fontSize: 12,
    marginBottom: 16,
  },
  triviaOptions: {
    gap: 8,
    marginBottom: 20,
  },
  triviaOptBtn: {
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  triviaOptText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  leaderboardTitle: {
    color: '#ffd700',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 6,
  },
  leaderboardBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 10,
  },
  emptyLeaderboard: {
    color: 'grey',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
  },
  leaderboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  playerRank: {
    color: '#ffffff',
    fontSize: 13,
  },
  playerScore: {
    color: '#ff00ff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchModalContent: {
    width: '85%',
    height: '65%',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  searchModalTitle: {
    color: '#ff00ff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchInput: {
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    paddingHorizontal: 12,
    color: '#ffffff',
    marginBottom: 16,
  },
  searchResultsList: {
    flex: 1,
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  resultCover: {
    width: 36,
    height: 36,
    borderRadius: 2,
  },
  resultMeta: {
    flex: 1,
    marginLeft: 10,
  },
  resultTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultAuthor: {
    color: 'grey',
    fontSize: 10,
  },
  addIcon: {
    fontSize: 16,
    padding: 4,
  },
  closeSearchBtn: {
    alignSelf: 'center',
    padding: 10,
  },
  closeSearchText: {
    color: 'grey',
    fontSize: 14,
  },
  inviteCard: {
    backgroundColor: '#1c1c1c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ff00ff',
    width: '80%',
    padding: 24,
    alignItems: 'center',
  },
  inviteHeader: {
    color: '#ff00ff',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  qrGridContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  qrRowChar: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#000000',
    fontSize: 12,
    lineHeight: 14,
  },
  inviteCodeLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  inviteShareBtn: {
    backgroundColor: '#ff00ff',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inviteShareText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 11,
  },
  inviteCloseBtn: {
    padding: 10,
  },
  inviteCloseText: {
    color: 'grey',
    fontSize: 12,
  },
});
