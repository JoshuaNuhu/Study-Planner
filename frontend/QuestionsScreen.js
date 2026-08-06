import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

export default function QuestionsScreen({ route, navigation }) {
  const { handoutId } = route.params; 
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Remembers user choices: e.g. { 0: "A. Choice", 1: "C. Choice" }
  const [selectedAnswers, setSelectedAnswers] = useState({});
  
  // Gamification & State
  const [score, setScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  
  const [isFinished, setIsFinished] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [totalXp, setTotalXp] = useState(0);

  const BACKEND_URL = 'http://10.107.215.183:5000';

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      
      const response = await fetch(`${BACKEND_URL}/handouts/${handoutId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        const loadedQuestions = data.questions || [];
        setQuestions(loadedQuestions); 

        // Populate historical attempts if viewing from history
        const initialAnswers = {};
        let initialScore = 0;
        loadedQuestions.forEach((q, idx) => {
          if (q.last_attempt && q.last_attempt.student_answer) {
            initialAnswers[idx] = q.last_attempt.student_answer;
            if (q.last_attempt.is_correct) {
              initialScore += 1;
            }
          }
        });

        setSelectedAnswers(initialAnswers);
        setScore(initialScore);
      } else {
        Alert.alert('Error', data.error || 'Failed to load questions.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionPress = (questionIndex, selectedOption, correctAnswer) => {
    if (selectedAnswers[questionIndex] !== undefined) return;

    const isCorrect = selectedOption === correctAnswer;

    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: selectedOption
    }));

    if (isCorrect) {
      setScore(prev => prev + 1);
      setXpEarned(prev => prev + 10);
    }
  };

  const handleFinishQuiz = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');

      // Map selected answers to specific question IDs
      const attemptsPayload = questions.map((q, index) => ({
        question_id: q.id,
        student_answer: selectedAnswers[index] || null
      })).filter(att => att.student_answer !== null);

      const response = await fetch(`${BACKEND_URL}/handouts/${handoutId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          xp_earned: xpEarned,
          score: score,
          total_questions: questions.length,
          attempts: attemptsPayload
        })
      });

      const data = await response.json();

      if (response.ok) {
        setTotalXp(data.xp_total);
        setIsFinished(true);
      } else {
        Alert.alert('Error', data.error || 'Failed to save XP.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not sync XP with server.');
    }
  };

  const handleGenerateNewQuestions = async () => {
    setGenerating(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${BACKEND_URL}/handouts/${handoutId}/generate-questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setQuestions(data);
        setSelectedAnswers({});
        setScore(0);
        setXpEarned(0);
        setIsFinished(false);
      } else {
        Alert.alert('Error', data.error || 'Failed to generate questions.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
    } finally {
      setGenerating(false);
    }
  };

  const getParsedOptions = (options) => {
    if (Array.isArray(options)) return options;
    if (typeof options === 'string') {
      try {
        return JSON.parse(options);
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
        <Text style={styles.loadingText}>Loading your study materials...</Text>
      </View>
    );
  }

  if (isFinished) {
    return (
      <View style={styles.container}>
        <View style={styles.resultsContainer}>
          <Text style={styles.header}>Quiz Complete!</Text>
          <Text style={styles.resultsText}>You scored {score} / {questions.length}</Text>
          <Text style={styles.resultsXpText}>Earned: +{xpEarned} XP</Text>
          <Text style={styles.resultsTotalXp}>Total XP: {totalXp}</Text>

          <TouchableOpacity 
            style={styles.regenerateButton} 
            onPress={handleGenerateNewQuestions}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#121212" />
            ) : (
              <Text style={styles.regenerateButtonText}>Generate Brand New Questions</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.returnButton} 
            onPress={() => navigation.goBack()}
            disabled={generating}
          >
            <Text style={styles.returnButtonText}>Return to Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      <View style={styles.statsCard}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>SCORE</Text>
          <Text style={styles.statValue}>{score} / {questions.length}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>XP EARNED</Text>
          <Text style={styles.xpValue}>⚡ +{xpEarned} XP</Text>
        </View>
      </View>

      <Text style={styles.header}>Practice Questions</Text>
      
      {questions.length === 0 ? (
        <Text style={styles.emptyText}>No questions found for this handout.</Text>
      ) : (
        questions.map((q, index) => {
          const hasAnswered = selectedAnswers[index] !== undefined;
          const parsedOptions = getParsedOptions(q.options);

          return (
            <View key={index} style={styles.card}>
              <View style={styles.tagContainer}>
                <Text style={styles.tagText}>{q.topic_tag}</Text>
              </View>
              <Text style={styles.questionText}>{index + 1}. {q.question_text}</Text>
              
              {parsedOptions.map((option, optIndex) => {
                const isSelected = selectedAnswers[index] === option;
                const isCorrect = q.correct_answer === option;
                
                let buttonStyle = styles.optionButton;
                let textStyle = styles.optionText;

                if (hasAnswered) {
                  if (isCorrect) {
                    buttonStyle = [styles.optionButton, styles.correctOption];
                    textStyle = [styles.optionText, styles.correctText];
                  } else if (isSelected && !isCorrect) {
                    buttonStyle = [styles.optionButton, styles.wrongOption];
                    textStyle = [styles.optionText, styles.wrongText];
                  }
                }

                return (
                  <TouchableOpacity 
                    key={optIndex} 
                    style={buttonStyle} 
                    onPress={() => handleOptionPress(index, option, q.correct_answer)}
                    activeOpacity={0.6}
                  >
                    <Text style={textStyle}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })
      )}

      <TouchableOpacity 
        style={styles.doneButton} 
        onPress={handleFinishQuiz}
      >
        <Text style={styles.buttonText}>Finish & Save XP</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { padding: 24 },
  loadingContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#A0A0A0', marginTop: 16, fontSize: 16 },
  statsCard: { flexDirection: 'row', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#333333', alignItems: 'center', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statLabel: { color: '#A0A0A0', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  statValue: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  xpValue: { color: '#BB86FC', fontSize: 20, fontWeight: 'bold' },
  divider: { width: 1, height: '80%', backgroundColor: '#333333' },
  header: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 20 },
  emptyText: { color: '#A0A0A0', fontSize: 16, fontStyle: 'italic' },
  card: { backgroundColor: '#1E1E1E', borderRadius: 12, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#333333' },
  tagContainer: { alignSelf: 'flex-start', backgroundColor: 'rgba(187, 134, 252, 0.15)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, marginBottom: 12 },
  tagText: { color: '#BB86FC', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  questionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 16, lineHeight: 24 },
  optionButton: { backgroundColor: '#2C2C2C', padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#333333' },
  optionText: { color: '#E0E0E0', fontSize: 15 },
  correctOption: { backgroundColor: 'rgba(76, 175, 80, 0.15)', borderColor: '#4CAF50' },
  correctText: { color: '#4CAF50', fontWeight: 'bold' },
  wrongOption: { backgroundColor: 'rgba(244, 67, 54, 0.15)', borderColor: '#F44336' },
  wrongText: { color: '#F44336', fontWeight: 'bold' },
  doneButton: { backgroundColor: '#333333', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 16, marginBottom: 32 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  resultsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  resultsText: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  resultsXpText: { color: '#BB86FC', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  resultsTotalXp: { color: '#A0A0A0', fontSize: 16, marginBottom: 32 },
  regenerateButton: { backgroundColor: '#BB86FC', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 16 },
  regenerateButtonText: { color: '#121212', fontSize: 16, fontWeight: 'bold' },
  returnButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#333333', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center' },
  returnButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});
