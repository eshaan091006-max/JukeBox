import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, Modal, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { supabase } from '../utils/supabase';
import { usePlayerStore } from '../store/usePlayerStore';
import { playClickSFX } from '../utils/sfxHelper';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const COLOR_OPTIONS = [
  { name: 'PINK', value: '#ff00ff' },
  { name: 'CYAN', value: '#00e5ff' },
  { name: 'GOLD', value: '#ffd700' },
  { name: 'GREEN', value: '#1DB954' }
];

export default function ProfileScreen({ navigation }) {
  const playTrack = usePlayerStore(state => state.playTrack);
  const cachedSongIds = usePlayerStore(state => state.cachedSongIds);
  const toggleDownloadTrack = usePlayerStore(state => state.toggleDownloadTrack);

  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  
  // Custom Profile state
  const [nickname, setNickname] = useState('RETRO USER');
  const [themeColor, setThemeColor] = useState('#ff00ff');
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [inputNickname, setInputNickname] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('#ff00ff');

  // Downloads state
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [isSongsLoading, setIsSongsLoading] = useState(false);

  // Spotify Authentication states
  const spotifyToken = usePlayerStore(state => state.spotifyToken);
  const setSpotifyToken = usePlayerStore(state => state.setSpotifyToken);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: '1fb2261355cd4979af85a0c79a225fd2',
      responseType: ResponseType.Code,
      usePKCE: true,
      scopes: [
        'user-read-currently-playing',
        'user-read-playback-state',
        'user-modify-playback-state',
        'streaming',
        'user-read-email',
      ],
      redirectUri: Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : makeRedirectUri({
            scheme: 'jukebox',
            useProxy: true,
          }),
    },
    discovery
  );

  const exchangeCodeForToken = async (code, codeVerifier) => {
    try {
      const details = {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : makeRedirectUri({
              scheme: 'jukebox',
              useProxy: true,
            }),
        client_id: '1fb2261355cd4979af85a0c79a225fd2',
        code_verifier: codeVerifier,
      };

      const formBody = Object.keys(details)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(details[key]))
        .join('&');

      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody,
      });

      const data = await res.json();
      if (data.access_token) {
        setSpotifyToken(data.access_token);

        if (data.refresh_token) {
          try {
            await supabase.from('spotify_config').upsert({ id: 'developer', refresh_token: data.refresh_token });
          } catch (err) {
            console.log("Failed to save shared Spotify config", err);
          }
        }

        if (Platform.OS === 'web') {
          alert("Connected to Spotify Premium successfully! Sharing enabled for all accounts.");
        } else {
          Alert.alert("Spotify Link", "Connected successfully! Sharing enabled for all accounts.");
        }
      } else {
        if (Platform.OS === 'web') {
          alert("Exchange failed: " + JSON.stringify(data));
        } else {
          Alert.alert("Exchange failed", JSON.stringify(data));
        }
      }
    } catch (e) {
      console.log("Token exchange error", e);
      if (Platform.OS === 'web') {
        alert("Exchange request failed: " + e.message);
      } else {
        Alert.alert("Exchange request failed", e.message);
      }
    }
  };

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      if (code && request?.codeVerifier) {
        exchangeCodeForToken(code, request.codeVerifier);
      }
    }
  }, [response, request]);


  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setEmail(user.email);
        
        // Fetch custom profile details from db
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          setNickname(data.nickname);
          setThemeColor(data.theme_color);
          setSelectedTheme(data.theme_color);
        }
      }
    };
    fetchUserAndProfile();
  }, []);

  // Fetch downloaded song metadata
  useEffect(() => {
    const fetchDownloadedMetadata = async () => {
      if (cachedSongIds.size === 0) {
        setDownloadedSongs([]);
        return;
      }

      setIsSongsLoading(true);
      try {
        const idsArray = Array.from(cachedSongIds).map(id => id.toString());
        const { data, error } = await supabase
          .from('songs')
          .select('*')
          .in('id', idsArray);

        if (error) throw error;
        setDownloadedSongs(data || []);
      } catch (e) {
        console.log("Error loading download details", e);
      } finally {
        setIsSongsLoading(false);
      }
    };
    fetchDownloadedMetadata();
  }, [cachedSongIds]);

  const handleUpdateProfile = async () => {
    if (!inputNickname.trim()) return;
    playClickSFX();

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          nickname: inputNickname.trim(),
          theme_color: selectedTheme,
        });

      if (error) throw error;
      setNickname(inputNickname.trim());
      setThemeColor(selectedTheme);
      setProfileModalVisible(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const handleLogout = () => {
    playClickSFX();
    const performLogout = async () => {
      try {
        await supabase.auth.signOut();
        navigation.navigate('Login');
      } catch (e) {
        console.log("Logout error", e);
      }
    };

    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm("ARE YOU SURE YOU WANT TO SIGN OUT OF JUKEBOX?");
      if (confirmLogout) {
        performLogout();
      }
    } else {
      Alert.alert(
        "SIGN OUT",
        "ARE YOU SURE YOU WANT TO SIGN OUT OF JUKEBOX?",
        [
          { text: "CANCEL", style: "cancel" },
          {
            text: "SIGN OUT",
            style: "destructive",
            onPress: performLogout
          }
        ]
      );
    }
  };

  const handlePlayDownloaded = (song) => {
    playTrack(song, downloadedSongs);
  };

  return (
    <View style={styles.container}>
      {/* Header Profile Info card */}
      <View style={[styles.profileHeaderCard, { borderColor: themeColor, shadowColor: themeColor }]}>
        <View style={[styles.avatarBorder, { borderColor: themeColor }]}>
          <Text style={styles.avatarText}>[P]</Text>
        </View>
        <Text style={styles.nickname}>{nickname.toUpperCase()}</Text>
        <Text style={styles.email}>{email}</Text>

        <View style={styles.profileActionsRow}>
          <TouchableOpacity 
            style={[styles.editBtn, { backgroundColor: themeColor }]}
            onPress={() => {
              setInputNickname(nickname);
              setProfileModalVisible(true);
              playClickSFX();
            }}
          >
            <Text style={styles.editBtnText}>EDIT PROFILE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.spotifyBtn, { borderColor: spotifyToken ? '#1DB954' : 'grey' }]}
            disabled={!request}
            onPress={() => {
              playClickSFX();
              if (request?.codeVerifier && Platform.OS === 'web') {
                localStorage.setItem('spotify_code_verifier', request.codeVerifier);
              }
              console.log("👉 COPY THIS EXACT URI TO YOUR SPOTIFY DEVELOPER DASHBOARD REDIRECTS:", makeRedirectUri({ scheme: 'jukebox', useProxy: Platform.OS !== 'web' }));
              promptAsync({ windowName: Platform.OS === 'web' ? '_self' : '_blank' });
            }}
          >
            <Text style={[styles.spotifyBtnText, { color: spotifyToken ? '#1DB954' : 'grey' }]}>
              {spotifyToken ? '[V] SPOTIFY LINKED' : '[+] LINK SPOTIFY'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Downloads Manager list */}
      <Text style={styles.sectionTitle}>[#] LOCAL DOWNLOADS</Text>
      {isSongsLoading ? (
        <ActivityIndicator size="small" color={themeColor} style={styles.loader} />
      ) : downloadedSongs.length === 0 ? (
        <View style={styles.emptyDownloads}>
          <Text style={styles.emptyText}>NO DOWNLOADED SONGS</Text>
          <Text style={styles.emptySub}>HEART SONGS TO SAVE THEM OFFLINE</Text>
        </View>
      ) : (
        <FlatList
          data={downloadedSongs}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.songRow}>
              <TouchableOpacity style={styles.songClickable} onPress={() => handlePlayDownloaded(item)}>
                <Image source={{ uri: item.cover_url }} style={styles.cover} />
                <View style={styles.meta}>
                  <Text style={styles.title} numberOfLines={1}>{item.title.toUpperCase()}</Text>
                  <Text style={styles.author} numberOfLines={1}>{item.author.toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  toggleDownloadTrack(item);
                  playClickSFX();
                }}
                style={styles.deleteBtn}
              >
                <Text style={styles.deleteIcon}>✕ DELETE</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Profile editor modal dialog */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={profileModalVisible}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>EDIT PIXEL PROFILE</Text>
            
            <Text style={styles.modalLabel}>NICKNAME</Text>
            <TextInput
              placeholder="ENTER NICKNAME"
              placeholderTextColor="grey"
              value={inputNickname}
              onChangeText={setInputNickname}
              style={styles.modalInput}
              maxLength={15}
            />

            <Text style={styles.modalLabel}>RETRO ACCENT COLOR</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setSelectedTheme(opt.value)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: opt.value, borderColor: selectedTheme === opt.value ? '#ffffff' : 'transparent' }
                  ]}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleUpdateProfile}>
                <Text style={styles.saveText}>SAVE CHANGES</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  profileHeaderCard: {
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    borderWidth: 2,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarBorder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  nickname: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  email: {
    color: 'grey',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 20,
  },
  profileActionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  editBtn: {
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  editBtnText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 1,
  },
  spotifyBtn: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  spotifyBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: 'grey',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 16,
  },
  loader: {
    marginTop: 20,
  },
  emptyDownloads: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  emptyText: {
    color: 'grey',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptySub: {
    color: 'grey',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 80,
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
  songClickable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  meta: {
    marginLeft: 14,
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  author: {
    color: 'grey',
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#ff4d4d',
    borderRadius: 8,
  },
  deleteIcon: {
    color: '#ff4d4d',
    fontSize: 10,
    fontWeight: 'bold',
  },
  logoutBtn: {
    alignSelf: 'center',
    padding: 16,
    marginBottom: 30,
  },
  logoutText: {
    color: '#ff4d4d',
    fontSize: 13,
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
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  modalTitle: {
    color: '#ff00ff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 1.5,
  },
  modalLabel: {
    color: 'grey',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 1,
  },
  modalInput: {
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    color: '#ffffff',
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginVertical: 12,
    marginBottom: 24,
  },
  colorCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 10,
  },
  cancelText: {
    color: 'grey',
    fontSize: 13,
  },
  saveText: {
    color: '#ff00ff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
