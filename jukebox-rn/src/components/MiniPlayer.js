import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import FullPlayer from './FullPlayer';

export default function MiniPlayer() {
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const togglePlay = usePlayerStore(state => state.togglePlay);
  
  const [modalVisible, setModalVisible] = useState(false);

  if (!currentTrack) return null;

  return (
    <View style={styles.outerContainer}>
      <TouchableOpacity style={styles.container} onPress={() => setModalVisible(true)}>
        <Image
          source={{ uri: currentTrack.cover_url || 'https://picsum.photos/id/1025/100/100' }}
          style={styles.cover}
        />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title.toUpperCase()}
          </Text>
          <Text style={styles.author} numberOfLines={1}>
            {currentTrack.author.toUpperCase()}
          </Text>
        </View>

        <TouchableOpacity onPress={togglePlay} style={styles.controlBtn}>
          <Text style={styles.controlText}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Full screen audio control slide-up */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <FullPlayer onClose={() => setModalVisible(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: 'transparent',
  },
  container: {
    height: 64,
    backgroundColor: '#282828',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 4,
  },
  meta: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  author: {
    color: '#b3b3b3',
    fontSize: 12,
    marginTop: 2,
  },
  controlBtn: {
    padding: 8,
    marginRight: 4,
  },
  controlText: {
    color: '#ff00ff',
    fontSize: 26,
    fontWeight: 'bold',
  },
});
