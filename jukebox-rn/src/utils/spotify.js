export async function getSpotifyDevices(token) {
  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    return data.devices || [];
  } catch (e) {
    console.log("Error fetching Spotify devices", e);
    return [];
  }
}

export async function playSpotifyTrack(spotifyUri, token, deviceId = null) {
  try {
    const url = deviceId 
      ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}` 
      : 'https://api.spotify.com/v1/me/player/play';

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: [spotifyUri],
      }),
    });
    return res.status === 204 || res.status === 200;
  } catch (e) {
    console.log("Error playing Spotify track", e);
    return false;
  }
}

export async function pauseSpotify(token) {
  try {
    await fetch('https://api.spotify.com/v1/me/player/pause', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (e) {
    console.log("Error pausing Spotify", e);
  }
}

export async function skipSpotifyNext(token) {
  try {
    await fetch('https://api.spotify.com/v1/me/player/next', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (e) {
    console.log("Error skipping Spotify", e);
  }
}
