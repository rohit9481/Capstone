import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../../components/ui/Header';
import LearningProgressHeader from '../../components/ui/LearningProgressHeader';
import AdaptiveNavigationBreadcrumb from '../../components/ui/AdaptiveNavigationBreadcrumb';
import FloatingActionAssistant from '../../components/ui/FloatingActionAssistant';
import QuestionCard from './components/QuestionCard';
import QuestionNavigation from './components/QuestionNavigation';
import QuestionOverview from './components/QuestionOverview';
import AssessmentSummary from './components/AssessmentSummary';
import Button from '../../components/ui/Button';
import questionGenerationService from '../../services/questionGenerationService';

const QuestionGenerationAssessment = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [confidence, setConfidence] = useState({});
  const [showValidation, setShowValidation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [sessionStatus, setSessionStatus] = useState('active'); // 'active' | 'paused' | 'submitted'
  const [showSummary, setShowSummary] = useState(false);
  const [lastSaved, setLastSaved] = useState('Just now');
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [concepts, setConcepts] = useState([]);
  const [learningPathway, setLearningPathway] = useState(null);
  const [evaluations, setEvaluations] = useState([]);

  const currentQuestion = questions?.[currentQuestionIndex];
  const totalQuestions = questions?.length;
  const answeredQuestions = Object.keys(answers);
  const completionPercentage =
    totalQuestions > 0
      ? Math.round((answeredQuestions.length / totalQuestions) * 100)
      : 0;

  // ----------------------------
  // Load concepts & generate questions
  // ----------------------------
  useEffect(() => {
    const loadData = async () => {
      let conceptsData = [];
      let pathwayData = null;

      if (location.state?.concepts) {
        conceptsData = location.state.concepts;
        pathwayData = location.state.learningPathway;
      } else {
        const storedConcepts = sessionStorage.getItem('extractedConcepts');
        const storedPathway = sessionStorage.getItem('learningPathway');
        if (storedConcepts) conceptsData = JSON.parse(storedConcepts);
        if (storedPathway) pathwayData = JSON.parse(storedPathway);
      }

      setConcepts(conceptsData);
      setLearningPathway(pathwayData);

      if (conceptsData?.length > 0) {
        await generateQuestionsFromConcepts(conceptsData);
      } else {
        navigate('/file-upload');
      }
    };

    loadData();
  }, [location.state, navigate]);

  const generateQuestionsFromConcepts = async (conceptsData) => {
    setIsGeneratingQuestions(true);
    try {
      const questionPromises = conceptsData.map((concept) =>
        questionGenerationService.generateQuestionsForConcept(concept, {
          questionCount: 5,
          questionTypes: ['multiple_choice', 'true_false', 'short_answer'],
        })
      );
      const questionSets = await Promise.all(questionPromises);
      const allQuestions = questionSets.flat();

      const shuffledQuestions = questionGenerationService.shuffleQuestions(allQuestions);
      const numberedQuestions = shuffledQuestions.map((q, idx) => ({ ...q, number: idx + 1 }));

      const publicQuestions = numberedQuestions.map(
        ({ id, number, type, difficulty, question, context, options, conceptId, conceptName, createdAt }) => ({
          id, number, type, difficulty, question, context, options, conceptId, conceptName, createdAt
        })
      );

      setQuestions(publicQuestions);
    } catch (error) {
      console.error('Error generating questions:', error);
      setQuestions([]);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  // ----------------------------
  // Timer
  // ----------------------------
  const timerRef = useRef(null);
  useEffect(() => {
    if (sessionStatus === 'active') {
      timerRef.current = setInterval(() => setSessionTime((prev) => prev + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [sessionStatus]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ----------------------------
  // Answer handling
  // ----------------------------
  const handleAnswerChange = (answer) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: answer }));
    setShowValidation(false);
  };

  const handleConfidenceChange = (level) => {
    setConfidence((prev) => ({ ...prev, [currentQuestion.id]: level }));
  };

  const handleNext = () => {
    if (!answers[currentQuestion.id]) {
      setShowValidation(true);
      return;
    }
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setShowValidation(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      setShowValidation(false);
    }
  };

  // ----------------------------
  // Save results to file
  // ----------------------------
  const saveResultsToFile = (results) => {
    const fileName = 'assessment_results.json';
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    console.log('Results saved:', fileName);
  };

  // ----------------------------
  // Submit Test
  // ----------------------------
  const handleSubmit = async () => {
    if (!answers[currentQuestion.id]) {
      setShowValidation(true);
      return;
    }

    setIsSubmitting(true);
    clearInterval(timerRef.current);
    setSessionStatus('submitted');

    try {
      const evaluationResults = await Promise.all(
        Object.keys(answers).map(async (questionId) => {
          const userAnswer = answers[questionId];
          return await questionGenerationService.evaluateAnswer({ id: questionId }, userAnswer);
        })
      );
      setEvaluations(evaluationResults);

      const results = generateAssessmentResults(evaluationResults);
      saveResultsToFile(results);

    } catch (error) {
      console.error('Error evaluating answers:', error);
    } finally {
      setIsSubmitting(false);
      setShowSummary(true);
    }
  };

  // ----------------------------
  // Generate assessment results (informative)
  // ----------------------------
  const generateAssessmentResults = (evals = evaluations) => {
    const totalQuestions = questions.length;            // 🔹 Use all questions
    const totalAnswered = evals.length;
    let correctCount = 0;
    const conceptPerformance = {};
  
    evals.forEach((evalResult) => {
      if (evalResult.isCorrect) correctCount++;
  
      const conceptId = evalResult.conceptId;
      if (!conceptPerformance[conceptId]) {
        conceptPerformance[conceptId] = {
          conceptName: evalResult.conceptName,
          correct: 0,
          total: 0,
          score: 0,
        };
      }
      conceptPerformance[conceptId].total++;
      if (evalResult.isCorrect) conceptPerformance[conceptId].correct++;
    });
  
    Object.values(conceptPerformance).forEach((perf) => {
      perf.score = Math.round((perf.correct / perf.total) * 100);
    });
  
    const weakAreas = [];
    const strongAreas = [];
    Object.values(conceptPerformance).forEach((perf) => {
      if (perf.score < 60) weakAreas.push({ topic: perf.conceptName, score: perf.score, correct: perf.correct, total: perf.total });
      else if (perf.score >= 80) strongAreas.push({ topic: perf.conceptName, score: perf.score, correct: perf.correct, total: perf.total });
    });
  
    return {
      totalQuestions,                                          // ✅ All questions
      correctAnswers: correctCount,
      incorrectAnswers: totalQuestions - correctCount,         // ✅ Includes unanswered
      averageConfidence: Object.values(confidence).length
        ? (Object.values(confidence).reduce((a, b) => a + b, 0) / Object.values(confidence).length).toFixed(1)
        : 3.0,
      timeSpent: formatTime(sessionTime),
      overallScore: totalQuestions
        ? Math.round((correctCount / totalQuestions) * 100)    // ✅ Based on all
        : 0,
      weakAreas,
      strongAreas,
      conceptPerformance,
    };
  };  

  // ----------------------------
  // Retake / Continue
  // ----------------------------
  const handleRetakeAssessment = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setConfidence({});
    setShowSummary(false);
    setSessionTime(0);
    setSessionStatus('active');
    setEvaluations([]);
  };

  const handleContinueToExplanations = () => {
    const results = generateAssessmentResults();
    navigate('/adaptive-learning-explanations', {
      state: {
        assessmentResults: results,
        weakAreas: results.weakAreas,
        concepts,
        learningPathway,
      },
    });
  };

  // ----------------------------
  // Render
  // ----------------------------
  if (isGeneratingQuestions) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Generating personalized questions...</p>
            <p className="text-sm text-muted-foreground mt-2">This may take a few moments</p>
          </div>
        </div>
      </div>
    );
  }

  if (showSummary) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <AssessmentSummary
          results={generateAssessmentResults()}
          evaluations={evaluations}
          onRetakeAssessment={handleRetakeAssessment}
          onContinueToExplanations={handleContinueToExplanations}
          sessionData={{ time: formatTime(sessionTime) }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <LearningProgressHeader
        currentPhase="Assessment"
        questionProgress={{ current: currentQuestionIndex + 1, total: totalQuestions }}
        completionPercentage={completionPercentage}
        sessionTime={formatTime(sessionTime)}
        onPause={() => setSessionStatus(sessionStatus === 'active' ? 'paused' : 'active')}
      />
      <AdaptiveNavigationBreadcrumb
        currentPhase="Assessment"
        completedPhases={['upload']}
        sessionProgress={{ completion: completionPercentage }}
      />

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-80 border-r bg-card/50">
          <div className="sticky top-32 p-4">
            <QuestionOverview
              questions={questions}
              currentQuestion={currentQuestion?.id}
              answeredQuestions={answeredQuestions}
              onQuestionSelect={(qid) => setCurrentQuestionIndex(questions.findIndex(q => q.id === qid))}
              onToggleOverview={() => {}}
              isVisible={true}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 max-w-4xl mx-auto">
          <div className="p-4 pb-24">
            <div className="flex justify-end mb-4 lg:hidden">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowOverview(!showOverview)}
              >
                Overview
              </Button>
            </div>

            <QuestionCard
              question={currentQuestion}
              currentAnswer={answers[currentQuestion?.id]}
              onAnswerChange={handleAnswerChange}
              onConfidenceChange={handleConfidenceChange}
              confidence={confidence[currentQuestion?.id] || 3}
              showValidation={showValidation}
              isSubmitted={false}
            />
          </div>

          <QuestionNavigation
            currentQuestion={currentQuestionIndex + 1}
            totalQuestions={totalQuestions}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSubmit={handleSubmit}
            canGoNext={!!answers[currentQuestion?.id]}
            canGoPrevious={currentQuestionIndex > 0}
            isLastQuestion={currentQuestionIndex === totalQuestions - 1}
            isSubmitting={isSubmitting}
            showValidation={showValidation}
          />
        </div>
      </div>

      {/* Mobile Question Overview */}
      <QuestionOverview
        questions={questions}
        currentQuestion={currentQuestion?.id}
        answeredQuestions={answeredQuestions}
        onQuestionSelect={(qid) => {
          setCurrentQuestionIndex(questions.findIndex(q => q.id === qid));
          setShowOverview(false);
        }}
        onToggleOverview={() => setShowOverview(false)}
        isVisible={showOverview}
      />

      <FloatingActionAssistant
        currentContext="assessment"
        onExplanationRequest={() => navigate('/adaptive-learning-explanations', {
          state: { currentQuestion, userAnswer: answers[currentQuestion?.id], confidence: confidence[currentQuestion?.id] || 3, concepts, learningPathway }
        })}
        onHelpRequest={() => console.log('Help requested')}
        onHintRequest={() => console.log('Hint requested')}
        disabled={sessionStatus === 'paused'}
      />
    </div>
  );
};

export default QuestionGenerationAssessment;
