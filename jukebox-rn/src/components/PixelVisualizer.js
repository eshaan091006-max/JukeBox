import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';

export default function PixelVisualizer() {
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const visualizerPreset = usePlayerStore(state => state.visualizerPreset);

  // Create 8 animated values for the columns
  const anims = useRef(Array.from({ length: 8 }, () => new Animated.Value(1.5))).current;
  const timer = useRef(null);

  useEffect(() => {
    if (isPlaying) {
      // Speed multiplier based on EQ Preset
      let intervalMs = 150;
      if (visualizerPreset === 'BASS BOOST') intervalMs = 80;
      if (visualizerPreset === 'CHILL WAVE') intervalMs = 220;

      timer.current = setInterval(() => {
        anims.forEach((anim) => {
          Animated.timing(anim, {
            toValue: 1 + Math.random() * 7, // Random active blocks (1 to 8)
            duration: intervalMs,
            useNativeDriver: false,
          }).start();
        });
      }, intervalMs);
    } else {
      if (timer.current) clearInterval(timer.current);
      // Reset to quiet base
      anims.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 1.5,
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
    }

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [isPlaying, visualizerPreset]);

  return (
    <View style={styles.container}>
      {anims.map((anim, index) => {
        return (
          <View key={index} style={styles.bar}>
            {/* Draw 8 stacking blocks per bar (from peak to bottom) */}
            {Array.from({ length: 8 }).map((_, blockIdx) => {
              const reverseIdx = 8 - blockIdx; // base is 8 (bottom), peak is 1 (top)

              // Decide active block styling based on anim height value
              const blockColor = anim.interpolate({
                inputRange: [reverseIdx - 0.5, reverseIdx, reverseIdx + 0.5],
                outputRange: [
                  'transparent',
                  blockIdx < 3 ? '#ff00ff' : blockIdx < 5 ? '#e000e0' : '#00e5ff',
                  blockIdx < 3 ? '#ff00ff' : blockIdx < 5 ? '#e000e0' : '#00e5ff',
                ],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={blockIdx}
                  style={[styles.block, { backgroundColor: blockColor }]}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 70,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    marginVertical: 10,
  },
  bar: {
    width: 14,
    height: 64,
    justifyContent: 'flex-end',
  },
  block: {
    height: 6,
    width: 14,
    marginVertical: 1,
    borderRadius: 1,
  },
});
