import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { supabase } from '../utils/supabase';
import { usePlayerStore } from '../store/usePlayerStore';

export default function SearchScreen() {
  const playTrack = usePlayerStore(state => state.playTrack);
  const spotifyToken = usePlayerStore(state => state.spotifyToken);
  
  const [userId, setUserId] = useState(null);
  const [allSongs, setAllSongs] = useState([]);
  const [songs, setSongs] = useState([]);
  const [likedSongIds, setLikedSongIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          fetchLikes(user.id);
        }
      } catch (e) {
        console.log("Auth session retrieve error in Search", e);
      }
      fetchSongs();
    };
    initData();
  }, []);

  const fetchSongs = async () => {
    try {
      const { data, error } = await supabase.from('songs').select('*');
      if (error) throw error;
      setAllSongs(data || []);
      setSongs(data || []);
    } catch (e) {
      console.log("Error loading songs", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLikes = async (uid) => {
    if (!uid) return;
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('songId')
        .eq('userId', uid);
      if (error) throw error;
      const ids = new Set(data.map(item => item.songId));
      setLikedSongIds(ids);
    } catch (e) {
      console.log("Likes fetch error", e);
    }
  };

  const handleToggleLike = async (song) => {
    if (!userId) return;
    const isLiked = likedSongIds.has(song.id.toString());
    const updatedLikes = new Set(likedSongIds);

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('userId', userId)
          .eq('songId', song.id.toString());
        if (error) throw error;
        updatedLikes.delete(song.id.toString());
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({
            userId: userId,
            songId: song.id.toString(),
            title: song.title,
            author: song.author,
            cover_url: song.cover_url,
            file_url: song.file_url || '',
          });
        if (error) throw error;
        updatedLikes.add(song.id.toString());
      }
      setLikedSongIds(updatedLikes);
    } catch (e) {
      console.log("Like toggle error", e);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      // 1. If Spotify integration is linked, query Spotify's catalog search endpoint
      if (spotifyToken) {
        if (!searchQuery.trim()) {
          setSongs([]);
          return;
        }
        const searchSpotify = async () => {
          try {
            const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track`, {
              headers: {
                Authorization: `Bearer ${spotifyToken}`,
              },
            });
            const data = await res.json();
            if (res.status !== 200) {
              alert("Spotify Search Error " + res.status + ": " + JSON.stringify(data));
              return;
            }
            if (data && data.tracks && data.tracks.items) {
              const mapped = data.tracks.items.map(item => ({
                id: item.id, // Spotify alphanumeric string ID
                title: item.name,
                author: item.artists.map(a => a.name).join(', '),
                cover_url: item.album.images[0]?.url || 'https://picsum.photos/id/1025/100/100',
                file_url: '',
                uri: item.uri, // Spotify track URI (e.g. spotify:track:...)
                duration_ms: item.duration_ms,
              }));
              setSongs(mapped);
            }
          } catch (e) {
            console.log("Spotify search request failed", e);
            alert("Spotify Search failed: " + e.message);
          }
        };
        searchSpotify();
        return;
      }

      // 2. Otherwise, fallback to offline filter Supabase songs catalog
      if (!searchQuery.trim()) {
        setSongs(allSongs);
        return;
      }

      const lowerText = searchQuery.toLowerCase();
      const filtered = allSongs.filter(song => {
        const title = (song.title || '').toLowerCase();
        const author = (song.author || '').toLowerCase();
        return title.includes(lowerText) || author.includes(lowerText);
      });
      setSongs(filtered);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, allSongs, spotifyToken]);

  const handleSearch = (text) => {
    setSearchQuery(text);
  };

  const renderSongRow = ({ item }) => {
    const isLiked = likedSongIds.has(item.id.toString());
    return (
      <TouchableOpacity style={styles.row} onPress={() => playTrack(item, songs)}>
        <Image
          source={{ uri: item.cover_url || 'https://picsum.photos/id/1025/100/100' }}
          style={styles.cover}
        />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>{item.title.toUpperCase()}</Text>
          <Text style={styles.author} numberOfLines={1}>{item.author.toUpperCase()}</Text>
        </View>

        <TouchableOpacity onPress={() => handleToggleLike(item)} style={styles.heartBtn}>
          <Text style={[styles.heartIcon, { color: isLiked ? '#ff00ff' : 'grey' }]}>
            {isLiked ? '♥' : '♡'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.playIcon}>▶</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <TextInput
          placeholder={spotifyToken ? "SEARCH LIVE SPOTIFY CATALOG..." : "SEARCH..."}
          placeholderTextColor="grey"
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#ff00ff" style={styles.loader} />
      ) : songs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{spotifyToken ? "TYPE TO QUERY SPOTIFY" : "NO SONGS FOUND"}</Text>
          <Text style={styles.emptySub}>{spotifyToken ? "Search millions of tracks" : "Check database"}</Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          renderItem={renderSongRow}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 16,
  },
  searchBarContainer: {
    marginTop: 48,
    marginBottom: 16,
  },
  searchInput: {
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  loader: {
    marginTop: 40,
  },
  listContainer: {
    paddingBottom: 150,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: 4,
  },
  meta: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  author: {
    color: 'grey',
    fontSize: 13,
    marginTop: 2,
  },
  heartBtn: {
    padding: 10,
  },
  heartIcon: {
    fontSize: 24,
  },
  playIcon: {
    color: 'grey',
    fontSize: 14,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    color: 'grey',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptySub: {
    color: 'grey',
    fontSize: 12,
    marginTop: 4,
  },
});
