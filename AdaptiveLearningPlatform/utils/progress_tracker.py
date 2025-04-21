import pandas as pd
import streamlit as st
import matplotlib.pyplot as plt
import io
import base64
from datetime import datetime

class ProgressTracker:
    """
    Class to track user progress and manage learning sessions
    """
    def __init__(self):
        # Initialize session state variables if they don't exist
        if 'progress_data' not in st.session_state:
            st.session_state.progress_data = pd.DataFrame(columns=[
                'timestamp', 'concept', 'question', 'user_answer', 
                'correct_answer', 'is_correct', 'attempts'
            ])
        
        if 'concept_mastery' not in st.session_state:
            st.session_state.concept_mastery = {}
        
        if 'current_session_id' not in st.session_state:
            st.session_state.current_session_id = datetime.now().strftime('%Y%m%d%H%M%S')
    
    def record_answer(self, question_data, user_answer, is_correct):
        """
        Record a user's answer to a question
        
        Args:
            question_data (dict): Data about the question
            user_answer (str): The user's selected answer
            is_correct (bool): Whether the answer was correct
        """
        concept = question_data.get('concept', 'Unknown')
        
        # Get current timestamp
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Update concept mastery
        if concept not in st.session_state.concept_mastery:
            st.session_state.concept_mastery[concept] = {
                'attempts': 1,
                'correct': 1 if is_correct else 0,
                'incorrect': 0 if is_correct else 1,
                'mastered': is_correct  # Consider mastered if answered correctly the first time
            }
        else:
            # Update existing concept mastery
            st.session_state.concept_mastery[concept]['attempts'] += 1
            
            if is_correct:
                st.session_state.concept_mastery[concept]['correct'] += 1
                # Mark as mastered if correct after previous attempts
                if st.session_state.concept_mastery[concept]['incorrect'] > 0:
                    st.session_state.concept_mastery[concept]['mastered'] = True
            else:
                st.session_state.concept_mastery[concept]['incorrect'] += 1
                st.session_state.concept_mastery[concept]['mastered'] = False
        
        # Record the answer in progress data
        new_record = pd.DataFrame([{
            'timestamp': timestamp,
            'concept': concept,
            'question': question_data.get('question', ''),
            'user_answer': user_answer,
            'correct_answer': question_data.get('correct_answer', ''),
            'is_correct': is_correct,
            'attempts': st.session_state.concept_mastery[concept]['attempts'],
            'session_id': st.session_state.current_session_id
        }])
        
        st.session_state.progress_data = pd.concat([st.session_state.progress_data, new_record], ignore_index=True)
    
    def get_weak_concepts(self, threshold=1):
        """
        Get concepts that need reinforcement (answered incorrectly more than threshold times)
        
        Args:
            threshold (int): Minimum number of incorrect answers to consider a concept weak
        
        Returns:
            list: List of weak concepts
        """
        weak_concepts = []
        
        for concept, data in st.session_state.concept_mastery.items():
            if data['incorrect'] > threshold and not data['mastered']:
                weak_concepts.append(concept)
        
        return weak_concepts
    
    def get_mastery_percentage(self):
        """
        Calculate the percentage of concepts mastered
        
        Returns:
            float: Percentage of concepts mastered (0-100)
        """
        if not st.session_state.concept_mastery:
            return 0.0
        
        total_concepts = len(st.session_state.concept_mastery)
        mastered_concepts = sum(1 for data in st.session_state.concept_mastery.values() if data['mastered'])
        
        return (mastered_concepts / total_concepts) * 100 if total_concepts > 0 else 0
    
    def generate_progress_chart(self):
        """
        Generate a progress chart showing concept mastery
        
        Returns:
            str: Base64 encoded PNG image of the chart
        """
        if not st.session_state.concept_mastery:
            return None
        
        # Create figure and axis
        fig, ax = plt.subplots(figsize=(10, 6))
        
        # Prepare data
        concepts = list(st.session_state.concept_mastery.keys())
        correct = [data['correct'] for data in st.session_state.concept_mastery.values()]
        incorrect = [data['incorrect'] for data in st.session_state.concept_mastery.values()]
        
        # Limit to top 10 concepts if there are many
        if len(concepts) > 10:
            # Sort by total attempts (descending)
            concept_attempts = [(c, st.session_state.concept_mastery[c]['attempts']) for c in concepts]
            concept_attempts.sort(key=lambda x: x[1], reverse=True)
            concepts = [c for c, _ in concept_attempts[:10]]
            correct = [st.session_state.concept_mastery[c]['correct'] for c in concepts]
            incorrect = [st.session_state.concept_mastery[c]['incorrect'] for c in concepts]
        
        # Shorten concept names if they're too long
        short_concepts = [c[:20] + '...' if len(c) > 20 else c for c in concepts]
        
        # Create stacked bar chart
        ax.bar(short_concepts, correct, label='Correct', color='green', alpha=0.7)
        ax.bar(short_concepts, incorrect, bottom=correct, label='Incorrect', color='red', alpha=0.7)
        
        # Add labels and title
        ax.set_ylabel('Number of Attempts')
        ax.set_title('Concept Mastery Progress')
        ax.legend()
        
        # Rotate x-axis labels for better readability
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        
        # Convert plot to base64 encoded string
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode()
        plt.close(fig)
        
        return img_str
    
    def get_performance_summary(self):
        """
        Get a summary of the user's performance
        
        Returns:
            dict: Performance summary statistics
        """
        if st.session_state.progress_data.empty:
            return {
                'total_questions': 0,
                'correct_answers': 0,
                'accuracy': 0,
                'mastered_concepts': 0,
                'weak_concepts': 0
            }
        
        total_questions = len(st.session_state.progress_data)
        correct_answers = st.session_state.progress_data['is_correct'].sum()
        accuracy = (correct_answers / total_questions) * 100 if total_questions > 0 else 0
        
        mastered_concepts = sum(1 for data in st.session_state.concept_mastery.values() if data['mastered'])
        weak_concepts = len(self.get_weak_concepts())
        
        return {
            'total_questions': total_questions,
            'correct_answers': correct_answers,
            'accuracy': accuracy,
            'mastered_concepts': mastered_concepts,
            'weak_concepts': weak_concepts
        }
    
    def reset_session(self):
        """
        Reset the current learning session but keep historical data
        """
        st.session_state.current_session_id = datetime.now().strftime('%Y%m%d%H%M%S')
        
        # Keep the progress data but reset concept mastery
        st.session_state.concept_mastery = {}
