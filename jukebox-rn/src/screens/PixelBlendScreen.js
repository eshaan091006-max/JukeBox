import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Share } from 'react-native';
import { Audio } from 'expo-av';
import { playClickSFX, playCoinSFX, playErrorSFX } from '../utils/sfxHelper';

const buddies = [
  { name: 'DJ_PIXEL', avatar: 'https://picsum.photos/id/1025/100/100' },
  { name: 'CHIP_GURU', avatar: 'https://picsum.photos/id/1084/100/100' },
  { name: 'LOFI_DEV', avatar: 'https://picsum.photos/id/1062/100/100' },
];

const triviaQuestions = [
  {
    songUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    correctAnswer: '8-BIT RETRO FUN',
    options: ['PIXEL CASTLE', '8-BIT RETRO FUN', 'CYBERPUNK DRIVE', 'SPACE INVASION'],
  },
  {
    songUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    correctAnswer: 'PIXEL CASTLE',
    options: ['CHIPTUNE ROCKS', 'CYBERPUNK DRIVE', 'PIXEL CASTLE', '8-BIT RETRO FUN'],
  },
];

const blendedSongs = [
  { id: '1', title: '8-Bit Retro Fun', author: 'Anwar Amr', cover_url: 'https://picsum.photos/id/1025/100/100' },
  { id: '2', title: 'Pixel Castle', author: 'Grayson', cover_url: 'https://picsum.photos/id/1084/100/100' },
  { id: '3', title: 'Cyberpunk Drive', author: 'Neon Pixel', cover_url: 'https://picsum.photos/id/1062/100/100' },
];

export default function PixelBlendScreen({ navigation }) {
  const [selectedBuddyIdx, setSelectedBuddyIdx] = useState(null);
  const [isBlending, setIsBlending] = useState(false);
  const [blendProgress, setBlendProgress] = useState(0);
  const [showResult, setShowResult] = useState(false);

  // Result state variables
  const [matchScore, setMatchScore] = useState(0);
  const [badgeName, setBadgeName] = useState('NEOPHYTE');

  // Trivia state variables
  const [showTrivia, setShowTrivia] = useState(false);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [triviaSound, setTriviaSound] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);

  const blendTimer = useRef(null);
  const countdownTimer = useRef(null);
  const playTimeout = useRef(null);

  const startBlend = () => {
    if (selectedBuddyIdx === null) return;
    playClickSFX();
    setIsBlending(true);
    setBlendProgress(0);

    let progress = 0;
    blendTimer.current = setInterval(() => {
      progress += 0.1;
      setBlendProgress(progress);

      if (progress >= 1.0) {
        clearInterval(blendTimer.current);
        const score = 70 + Math.floor(Math.random() * 25);
        let badge = 'CHIPTUNE NOVICE';
        if (score > 80) badge = 'SYNTH SAVANT';
        if (score > 90) badge = '8-BIT OVERLORD';

        setMatchScore(score);
        setBadgeName(badge);
        setIsBlending(false);
        setShowResult(true);
      }
    }, 200);
  };

  const startTriviaQuiz = async () => {
    playClickSFX();
    setShowTrivia(true);
    setIsAnswered(false);
    setSelectedAnswer(null);
    setIsCorrect(false);
    setSecondsLeft(5);

    const qIdx = Math.floor(Math.random() * triviaQuestions.length);
    setActiveQuestionIdx(qIdx);

    const question = triviaQuestions[qIdx];
    try {
      if (triviaSound) {
        await triviaSound.unloadAsync().catch(() => {});
      }
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: question.songUrl },
        { shouldPlay: true }
      );
      setTriviaSound(newSound);

      // 5-second countdown ticker
      countdownTimer.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimer.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Auto stop after 5s
      playTimeout.current = setTimeout(async () => {
        if (newSound) {
          await newSound.stopAsync().catch(() => {});
        }
      }, 5000);

    } catch (e) {
      console.log(e);
    }
  };

  const handleTriviaAnswer = (answer) => {
    if (isAnswered) return;
    setIsAnswered(true);
    setSelectedAnswer(answer);
    clearInterval(countdownTimer.current);

    const correct = answer === triviaQuestions[activeQuestionIdx].correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      playCoinSFX();
      setMatchScore(prev => Math.min(prev + 5, 100));
    } else {
      playErrorSFX();
    }
  };

  const handleCloseTrivia = async () => {
    playClickSFX();
    clearInterval(countdownTimer.current);
    clearTimeout(playTimeout.current);
    if (triviaSound) {
      await triviaSound.unloadAsync().catch(() => {});
      setTriviaSound(null);
    }
    setShowTrivia(false);
  };

  const handleShareCard = async () => {
    playClickSFX();
    try {
      await Share.share({
        message: `🕹️ JUKEBOX PIXEL BLEND RECEIPT! 🕹️\nI blended my profile with ${buddies[selectedBuddyIdx].name} and scored a ${matchScore}% MATCH!\nBadge: ${badgeName}\nCheck out yours at JukeBox!`,
      });
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    return () => {
      clearInterval(blendTimer.current);
      clearInterval(countdownTimer.current);
      clearTimeout(playTimeout.current);
      if (triviaSound) {
        triviaSound.unloadAsync().catch(() => {});
      }
    };
  }, [triviaSound]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {!isBlending && !showResult && !showTrivia && (
        <View style={styles.setupView}>
          <Text style={styles.sectionHeader}>SELECT A BUDDY TO BLEND WITH</Text>
          <View style={styles.buddyRow}>
            {buddies.map((buddy, index) => {
              const isSelected = selectedBuddyIdx === index;
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.buddyCard}
                  onPress={() => setSelectedBuddyIdx(index)}
                >
                  <View style={[styles.avatarBorder, { borderColor: isSelected ? '#ff00ff' : 'transparent' }]}>
                    <Image source={{ uri: buddy.avatar }} style={styles.avatar} />
                  </View>
                  <Text style={[styles.buddyName, { color: isSelected ? '#ff00ff' : 'grey' }]}>{buddy.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.blendBtn, { opacity: selectedBuddyIdx !== null ? 1 : 0.4 }]}
            disabled={selectedBuddyIdx === null}
            onPress={startBlend}
          >
            <Text style={styles.blendBtnText}>START PIXEL BLEND</Text>
          </TouchableOpacity>
        </View>
      )}

      {isBlending && (
        <View style={styles.blendLoader}>
          <Text style={styles.loaderTitle}>ANALYZING CHIPTUNE FREQUENCIES...</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${blendProgress * 100}%` }]} />
          </View>
        </View>
      )}

      {showResult && !showTrivia && (
        <View style={styles.resultView}>
          {/* Aesthetic Music Receipt Card */}
          <View style={styles.receiptCard}>
            <Text style={styles.receiptHeader}>=== JUKEBOX MUSIC SLIP ===</Text>
            <Text style={styles.receiptDivider}>--------------------------</Text>
            
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaText}>HOST: USER_ME</Text>
              <Text style={styles.receiptMetaText}>BUDDY: {buddies[selectedBuddyIdx].name}</Text>
            </View>
            <Text style={styles.receiptDivider}>--------------------------</Text>

            <Text style={styles.receiptScoreTitle}>COMPATIBILITY MATCH:</Text>
            <Text style={styles.receiptScoreVal}>{matchScore}%</Text>
            
            <Text style={styles.receiptBadgeTitle}>VIBE TIER STATUS:</Text>
            <Text style={styles.receiptBadgeVal}>{badgeName.toUpperCase()}</Text>
            <Text style={styles.receiptDivider}>--------------------------</Text>

            <Text style={styles.receiptFooter}>THANK YOU FOR VIBING!</Text>
            <Text style={styles.receiptFooter}>WWW.JUKE-BOX1.VERCEL.APP</Text>
            <Text style={styles.receiptDivider}>--------------------------</Text>

            <TouchableOpacity style={styles.shareBtn} onPress={handleShareCard}>
              <Text style={styles.shareBtnText}>[+] EXPORT RECEIPT CARD</Text>
            </TouchableOpacity>
          </View>

          {/* Trivia game card */}
          <View style={styles.gamePromoCard}>
            <Text style={styles.promoTitle}>⚡ PLAY CHIPTUNE TRIVIA FOR +5% MATCH BONUS!</Text>
            <TouchableOpacity style={styles.gameBtn} onPress={startTriviaQuiz}>
              <Text style={styles.gameBtnText}>PLAY CHIPTUNE TRIVIA</Text>
            </TouchableOpacity>
          </View>

          {/* Song list */}
          <Text style={styles.listHeader}>BLENDED PLAYLIST</Text>
          {blendedSongs.map(song => (
            <View key={song.id} style={styles.songRow}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>💿</Text>
              </View>
              <View style={styles.songMeta}>
                <Text style={styles.songTitle}>{song.title.toUpperCase()}</Text>
                <Text style={styles.songAuthor}>{song.author.toUpperCase()}</Text>
              </View>
            </View>
          ))}
          
          <TouchableOpacity onPress={() => setShowResult(false)} style={styles.backSetupBtn}>
            <Text style={styles.backSetupText}>BACK TO SETUP</Text>
          </TouchableOpacity>
        </View>
      )}

      {showTrivia && (
        <View style={styles.triviaView}>
          <View style={styles.triviaTopBar}>
            <Text style={styles.triviaHeader}>CHIPTUNE TRIVIA</Text>
            <TouchableOpacity onPress={handleCloseTrivia} style={styles.exitTriviaBtn}>
              <Text style={styles.exitTriviaText}>✕ CLOSE</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.triviaSub}>Listen to the song snippet and guess the title!</Text>

          {/* Timer Display */}
          <View style={styles.timerRing}>
            <Text style={styles.timerText}>{secondsLeft}s</Text>
          </View>

          {/* Answer Status */}
          {isAnswered && (
            <View style={styles.statusBox}>
              <Text style={[styles.statusText, { color: isCorrect ? '#ff00ff' : '#ff4d4d' }]}>
                {isCorrect ? '🎉 CORRECT! +5% MATCH APPLIED' : '✕ INCORRECT! TRY AGAIN NEXT TIME'}
              </Text>
            </View>
          )}

          {/* Multiple choice options */}
          <View style={styles.optionsList}>
            {triviaQuestions[activeQuestionIdx].options.map((option, idx) => {
              const isSelected = selectedAnswer === option;
              const isCorrectOpt = option === triviaQuestions[activeQuestionIdx].correctAnswer;

              let btnBg = 'rgba(255, 255, 255, 0.08)';
              if (isAnswered) {
                if (isCorrectOpt) btnBg = '#ff00ff';
                else if (isSelected) btnBg = '#ff4d4d';
              }

              return (
                <TouchableOpacity
                  key={idx}
                  disabled={isAnswered}
                  style={[styles.optionBtn, { backgroundColor: btnBg }]}
                  onPress={() => handleTriviaAnswer(option)}
                >
                  <Text style={[styles.optionText, { color: isAnswered && (isCorrectOpt || isSelected) ? '#000000' : '#ffffff' }]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  contentContainer: {
    paddingBottom: 150,
  },
  sectionHeader: {
    color: 'grey',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 24,
    textAlign: 'center',
  },
  buddyRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginVertical: 12,
    marginBottom: 32,
  },
  buddyCard: {
    alignItems: 'center',
  },
  avatarBorder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  buddyName: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  blendBtn: {
    backgroundColor: '#ff00ff',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  blendBtnText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  blendLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  loaderTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 1.5,
  },
  progressBarBg: {
    width: '80%',
    height: 6,
    backgroundColor: '#1e1e1e',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ff00ff',
  },
  resultView: {
    alignItems: 'center',
    width: '100%',
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d0d0d0',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  receiptHeader: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 8,
  },
  receiptDivider: {
    color: '#000000',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  receiptMetaRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  receiptMetaText: {
    color: '#000000',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  receiptScoreTitle: {
    color: '#333333',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 8,
  },
  receiptScoreVal: {
    color: '#000000',
    fontSize: 48,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginVertical: 8,
  },
  receiptBadgeTitle: {
    color: '#333333',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 8,
  },
  receiptBadgeVal: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginVertical: 4,
    letterSpacing: 1,
  },
  receiptFooter: {
    color: '#333333',
    fontSize: 9,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: 4,
  },
  shareBtn: {
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    marginTop: 16,
  },
  shareBtnText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  gamePromoCard: {
    backgroundColor: '#161616',
    width: '100%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 24,
  },
  promoTitle: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  gameBtn: {
    backgroundColor: '#ffd700',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gameBtnText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 11,
  },
  listHeader: {
    color: 'grey',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
  },
  songMeta: {
    marginLeft: 12,
  },
  songTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  songAuthor: {
    color: 'grey',
    fontSize: 12,
    marginTop: 2,
  },
  backSetupBtn: {
    marginTop: 30,
    padding: 12,
  },
  backSetupText: {
    color: 'grey',
    fontSize: 13,
    fontWeight: 'bold',
  },
  triviaView: {
    width: '100%',
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  triviaTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exitTriviaBtn: {
    padding: 6,
    borderWidth: 1,
    borderColor: '#ff4d4d',
    borderRadius: 4,
  },
  exitTriviaText: {
    color: '#ff4d4d',
    fontSize: 10,
    fontWeight: 'bold',
  },
  triviaHeader: {
    color: '#ffd700',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  triviaSub: {
    color: 'grey',
    fontSize: 12,
    marginBottom: 20,
  },
  timerRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#ffd700',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  timerText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusBox: {
    marginBottom: 20,
    alignItems: 'center',
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  optionsList: {
    gap: 10,
  },
  optionBtn: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  optionText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
});
