import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Image, Animated, SafeAreaView } from 'react-native';
import { Audio } from 'expo-av';
import { usePlayerStore } from '../store/usePlayerStore';

const stories = [
  {
    id: "1",
    username: "DJ_PIXEL",
    avatarUrl: "https://picsum.photos/id/1025/100/100",
    songTitle: "8-Bit Retro Fun",
    songAuthor: "Anwar Amr",
    songUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    coverUrl: "https://picsum.photos/id/1025/300/300",
    caption: "Vibing to this new chiptune draft! 🎧🕹️",
  },
  {
    id: "2",
    username: "CHIP_GURU",
    avatarUrl: "https://picsum.photos/id/1084/100/100",
    songTitle: "Pixel Castle",
    songAuthor: "Grayson",
    songUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    coverUrl: "https://picsum.photos/id/1084/300/300",
    caption: "Retro gaming in the dark tonight. 🏰✨",
  },
  {
    id: "3",
    username: "LOFI_DEV",
    avatarUrl: "https://picsum.photos/id/1062/100/100",
    songTitle: "Cyberpunk Drive",
    songAuthor: "Neon Pixel",
    songUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    coverUrl: "https://picsum.photos/id/1062/300/300",
    caption: "Late night coding session loops. 💻🌌",
  },
];

export default function MusicStories() {
  const globalSound = usePlayerStore(state => state.sound);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [storySound, setStorySound] = useState(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Pause main player when story launches
  const launchStory = (index) => {
    if (globalSound) {
      globalSound.pauseAsync().catch(() => {});
    }
    setActiveStoryIdx(index);
    setModalVisible(true);
    playStoryAudio(stories[index]);
  };

  const playStoryAudio = async (story) => {
    if (storySound) {
      await storySound.unloadAsync().catch(() => {});
    }

    progressAnim.setValue(0);

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: story.songUrl },
        { shouldPlay: true }
      );
      setStorySound(newSound);

      // Start 10-second bar progress fill
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          nextStory();
        }
      });
    } catch (e) {
      console.log("Error loading story audio", e);
      nextStory();
    }
  };

  const nextStory = () => {
    if (activeStoryIdx + 1 < stories.length) {
      setActiveStoryIdx(prev => {
        const nextIdx = prev + 1;
        playStoryAudio(stories[nextIdx]);
        return nextIdx;
      });
    } else {
      closeStory();
    }
  };

  const prevStory = () => {
    if (activeStoryIdx > 0) {
      setActiveStoryIdx(prev => {
        const prevIdx = prev - 1;
        playStoryAudio(stories[prevIdx]);
        return prevIdx;
      });
    } else {
      closeStory();
    }
  };

  const closeStory = async () => {
    progressAnim.setValue(0);
    if (storySound) {
      await storySound.unloadAsync().catch(() => {});
      setStorySound(null);
    }
    setModalVisible(false);
  };

  useEffect(() => {
    return () => {
      if (storySound) {
        storySound.unloadAsync().catch(() => {});
      }
    };
  }, [storySound]);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {stories.map((story, index) => (
          <TouchableOpacity key={story.id} style={styles.bubble} onPress={() => launchStory(index)}>
            <View style={styles.avatarBorder}>
              <Image source={{ uri: story.avatarUrl }} style={styles.avatar} />
            </View>
            <Text style={styles.username} numberOfLines={1}>{story.username}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Full-Screen Stories Overlay */}
      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <SafeAreaView style={styles.modalBg}>
          {/* Progress Indicators Header */}
          <View style={styles.progressRow}>
            {stories.map((_, idx) => {
              let widthVal = '0%';
              if (idx < activeStoryIdx) widthVal = '100%';
              if (idx === activeStoryIdx) {
                return (
                  <View key={idx} style={styles.progressBarBg}>
                    <Animated.View
                      style={[
                        styles.progressBarFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                  </View>
                );
              }
              return (
                <View key={idx} style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: widthVal }]} />
                </View>
              );
            })}
          </View>

          {/* User profile & close header */}
          <View style={styles.storyHeader}>
            <Image source={{ uri: stories[activeStoryIdx].avatarUrl }} style={styles.smallAvatar} />
            <Text style={styles.storyUser}>{stories[activeStoryIdx].username}</Text>
            <TouchableOpacity onPress={closeStory} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Nav tap-zones (Placed with zIndex 9 to block content card clicks) */}
          <View style={styles.tapZoneRow}>
            <TouchableOpacity style={styles.leftTap} onPress={prevStory} />
            <TouchableOpacity style={styles.rightTap} onPress={nextStory} />
          </View>

          {/* Story Content Card (Placed with zIndex 8 below tap zones) */}
          <View style={styles.contentCard}>
            <View style={styles.coverBorder}>
              <Image source={{ uri: stories[activeStoryIdx].coverUrl }} style={styles.coverImage} />
            </View>
            <Text style={styles.songTitle}>{stories[activeStoryIdx].songTitle.toUpperCase()}</Text>
            <Text style={styles.songAuthor}>{stories[activeStoryIdx].songAuthor.toUpperCase()}</Text>
            <View style={styles.captionBox}>
              <Text style={styles.captionText}>{stories[activeStoryIdx].caption}</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 100,
    marginVertical: 10,
  },
  bubble: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  avatarBorder: {
    padding: 2,
    borderWidth: 2,
    borderColor: '#1DB954',
    borderRadius: 32,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  username: {
    color: '#b3b3b3',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 6,
    width: 65,
    textAlign: 'center',
  },
  modalBg: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  progressRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: '#3e3e3e',
    marginHorizontal: 2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1DB954',
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
    zIndex: 10, // Sits in front of tap-zones
  },
  smallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  storyUser: {
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: 'bold',
    fontSize: 14,
  },
  closeBtn: {
    marginLeft: 'auto',
    padding: 8,
  },
  closeText: {
    color: '#ffffff',
    fontSize: 20,
  },
  tapZoneRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 9, // Sits in front of content card but below header close button
  },
  leftTap: {
    flex: 1.2, // Gives slightly larger tap zone for rewind
  },
  rightTap: {
    flex: 2,
  },
  contentCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 8, // Sits below tap zones
  },
  coverBorder: {
    padding: 8,
    borderWidth: 3,
    borderColor: '#1DB954',
    borderRadius: 16,
    backgroundColor: '#181818',
    marginBottom: 24,
  },
  coverImage: {
    width: 220,
    height: 220,
    borderRadius: 8,
  },
  songTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  songAuthor: {
    color: '#b3b3b3',
    fontSize: 16,
    marginTop: 4,
    textAlign: 'center',
  },
  captionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  captionText: {
    color: '#ffffff',
    fontSize: 15,
    textAlign: 'center',
  },
});
