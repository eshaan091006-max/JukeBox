import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_REGISTRY_KEY = '@jukebox_cached_songs';

// 1. Get list of cached song IDs
export const getCachedSongIds = async () => {
  try {
    const listJson = await AsyncStorage.getItem(CACHE_REGISTRY_KEY);
    return listJson ? JSON.parse(listJson) : [];
  } catch (e) {
    console.log("Error reading cache registry", e);
    return [];
  }
};

// 2. Download and save track to local device storage
export const downloadTrack = async (songId, fileUrl) => {
  if (!fileUrl) return null;
  const localPath = `${FileSystem.documentDirectory}${songId}.mp3`;

  try {
    const downloadRes = await FileSystem.downloadAsync(fileUrl, localPath);
    if (downloadRes.status === 200) {
      const cachedList = await getCachedSongIds();
      if (!cachedList.includes(songId)) {
        cachedList.push(songId);
        await AsyncStorage.setItem(CACHE_REGISTRY_KEY, JSON.stringify(cachedList));
      }
      return localPath;
    }
  } catch (e) {
    console.log("Error downloading track", e);
  }
  return null;
};

// 3. Remove downloaded local track file
export const deleteCachedTrack = async (songId) => {
  const localPath = `${FileSystem.documentDirectory}${songId}.mp3`;
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localPath);
    }
    const cachedList = await getCachedSongIds();
    const updatedList = cachedList.filter(id => id !== songId);
    await AsyncStorage.setItem(CACHE_REGISTRY_KEY, JSON.stringify(updatedList));
  } catch (e) {
    console.log("Error deleting cached track", e);
  }
};

// 4. Resolve playing URI (returns local path if cached, otherwise remote URL)
export const resolveTrackUri = async (songId, remoteUrl) => {
  const localPath = `${FileSystem.documentDirectory}${songId}.mp3`;
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      return localPath;
    }
  } catch (e) {
    console.log("Error checking cached path", e);
  }
  return remoteUrl;
};
