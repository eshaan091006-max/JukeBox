import { Audio } from 'expo-av';

const COIN_SFX_URL = 'https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav';
const ERROR_SFX_URL = 'https://assets.mixkit.co/active_storage/sfx/2017/2017-84.wav';
const CLICK_SFX_URL = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav';

let sfxSoundInstance = null;

const playSFX = async (url) => {
  try {
    if (sfxSoundInstance) {
      await sfxSoundInstance.unloadAsync().catch(() => {});
    }
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true }
    );
    sfxSoundInstance = sound;
  } catch (e) {
    console.log("SFX play error", e);
  }
};

export const playCoinSFX = () => playSFX(COIN_SFX_URL);
export const playErrorSFX = () => playSFX(ERROR_SFX_URL);
export const playClickSFX = () => playSFX(CLICK_SFX_URL);
