import streamlit as st
import pandas as pd
import time
import random
import os
from utils.pdf_processing import extract_text_from_pdf, preprocess_text, split_text_into_chunks
from utils.concept_extraction import extract_key_concepts, categorize_concepts
from utils.mcq_generator import generate_mcqs_batch, evaluate_answer
from utils.progress_tracker import ProgressTracker

# Page configuration
st.set_page_config(
    page_title="AI Adaptive Learning System",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Add JavaScript for text-to-speech functionality and button styling
st.markdown("""
<style>
.voice-button {
    background-color: #4CAF50;
    border: none;
    color: white;
    padding: 8px 16px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 14px;
    margin: 4px 2px;
    cursor: pointer;
    border-radius: 12px;
    transition-duration: 0.4s;
}
.voice-button:hover {
    background-color: #45a049;
    box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2);
}
</style>

<script>
function speakText(text) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        // Create a new speech synthesis utterance
        var utterance = new SpeechSynthesisUtterance(text);
        
        // Customize voice if needed
        utterance.rate = 0.9;  // slightly slower speed
        utterance.pitch = 1;   // normal pitch
        
        // Speak the text
        window.speechSynthesis.speak(utterance);
    } else {
        console.log("Text-to-speech not supported in this browser.");
    }
}

// Apply the voice-button class to all speech buttons when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Find all buttons with speakText in their onclick attribute
    var speechButtons = document.querySelectorAll('button[onclick^="speakText"]');
    
    // Add the voice-button class to each button
    speechButtons.forEach(function(button) {
        button.classList.add('voice-button');
    });
});
</script>
""", unsafe_allow_html=True)

# Initialize session state variables
if 'extracted_text' not in st.session_state:
    st.session_state.extracted_text = ""
if 'key_concepts' not in st.session_state:
    st.session_state.key_concepts = []
if 'categorized_concepts' not in st.session_state:
    st.session_state.categorized_concepts = {}
if 'current_mcqs' not in st.session_state:
    st.session_state.current_mcqs = []
if 'current_mcq_index' not in st.session_state:
    st.session_state.current_mcq_index = 0
if 'show_question' not in st.session_state:
    st.session_state.show_question = False
if 'show_explanation' not in st.session_state:
    st.session_state.show_explanation = False
if 'user_answer' not in st.session_state:
    st.session_state.user_answer = None
if 'learning_mode' not in st.session_state:
    st.session_state.learning_mode = "explore"  # "explore" or "assessment"
if 'difficulty_level' not in st.session_state:
    st.session_state.difficulty_level = "medium"

# Initialize progress tracker
progress_tracker = ProgressTracker()

# Main app title
st.title("AI Adaptive Learning System")
st.markdown("---")

# Sidebar for navigation and settings
with st.sidebar:
    st.header("Navigation")
    app_mode = st.radio(
        "Choose Mode:",
        ["Upload & Extract", "Explore Concepts", "Assessment", "Progress Tracking"]
    )
    
    if app_mode == "Assessment":
        st.subheader("Assessment Settings")
        st.session_state.difficulty_level = st.select_slider(
            "Difficulty Level",
            options=["easy", "medium", "hard"],
            value=st.session_state.difficulty_level
        )
        
        num_questions = st.slider(
            "Number of Questions",
            min_value=5,
            max_value=20,
            value=10,
            step=5
        )
    
    # Using spaCy for NLP processing
    st.success("Using spaCy for natural language processing")
    st.info("This system uses local NLP processing with spaCy")
    
    st.markdown("---")
    st.markdown("### About")
    st.markdown("""
    This AI-powered adaptive learning system:
    - Extracts key concepts from PDF documents
    - Generates multiple-choice questions
    - Adapts to your learning needs
    - Tracks your progress over time
    """)

# Upload & Extract mode
if app_mode == "Upload & Extract":
    st.header("Upload Document")
    st.markdown("Upload a PDF document to extract key concepts and generate questions.")
    
    col1, col2 = st.columns([3, 1])
    with col1:
        uploaded_file = st.file_uploader("Choose a PDF file", type="pdf")
    
    with col2:
        if st.button("Use Test Document"):
            try:
                uploaded_file = open("test_document.pdf", "rb")
                st.success("Test document loaded!")
            except Exception as e:
                st.error(f"Error loading test document: {str(e)}")
    
    if uploaded_file is not None:
        with st.spinner("Extracting text from PDF..."):
            extracted_text = extract_text_from_pdf(uploaded_file)
            
            if extracted_text:
                st.session_state.extracted_text = preprocess_text(extracted_text)
                
                # Show a sample of the extracted text
                st.subheader("Sample Extracted Text")
                st.text_area("Preview", st.session_state.extracted_text[:1000] + "...", height=200, disabled=True)
                
                # Extract key concepts
                with st.spinner("Extracting key concepts..."):
                    st.session_state.key_concepts = extract_key_concepts(st.session_state.extracted_text)
                    st.session_state.categorized_concepts = categorize_concepts(
                        st.session_state.key_concepts, 
                        st.session_state.extracted_text
                    )
                
                st.success(f"Successfully extracted {len(st.session_state.key_concepts)} key concepts!")
                
                # Show some key concepts
                st.subheader("Key Concepts Identified")
                for topic, concepts in st.session_state.categorized_concepts.items():
                    if concepts:  # Only show topics with concepts
                        with st.expander(f"Topic: {topic} ({len(concepts)} concepts)"):
                            st.write(", ".join(concepts))
                
                # Guide user to next step
                st.info("Navigate to 'Explore Concepts' or 'Assessment' to continue your learning journey.")
            else:
                st.error("Failed to extract text from the PDF. Please try another file.")

# Explore Concepts mode
elif app_mode == "Explore Concepts":
    st.header("Explore Concepts")
    
    if not st.session_state.extracted_text:
        st.warning("Please upload a document in the 'Upload & Extract' section first.")
    else:
        st.markdown("Browse through the key concepts extracted from your document.")
        
        # Show categorized concepts with the ability to generate MCQs for selected ones
        for topic, concepts in st.session_state.categorized_concepts.items():
            if concepts:  # Only show topics with concepts
                with st.expander(f"Topic: {topic}"):
                    # Display concepts as a multiselect
                    selected_concepts = st.multiselect(
                        "Select concepts to explore",
                        options=concepts,
                        key=f"multiselect_{topic}"
                    )
                    
                    if selected_concepts:
                        if st.button(f"Generate questions for selected concepts in {topic}", key=f"btn_{topic}"):
                            # Generate MCQs for selected concepts
                            with st.spinner("Generating questions..."):
                                mcqs = generate_mcqs_batch(
                                    selected_concepts,
                                    st.session_state.extracted_text,
                                    num_questions=len(selected_concepts),
                                    difficulty_level=st.session_state.difficulty_level
                                )
                                
                                if mcqs:
                                    st.session_state.current_mcqs = mcqs
                                    st.session_state.current_mcq_index = 0
                                    st.session_state.show_question = True
                                    st.session_state.learning_mode = "explore"
                                    st.rerun()
                                else:
                                    st.error("Failed to generate questions. Please try again.")
        
        # Display the current question if in exploration mode
        if st.session_state.show_question and st.session_state.learning_mode == "explore":
            if st.session_state.current_mcqs and 0 <= st.session_state.current_mcq_index < len(st.session_state.current_mcqs):
                st.markdown("---")
                
                current_mcq = st.session_state.current_mcqs[st.session_state.current_mcq_index]
                
                st.subheader(f"Question {st.session_state.current_mcq_index + 1} of {len(st.session_state.current_mcqs)}")
                st.markdown(f"**Concept: {current_mcq['concept']}**")
                st.markdown(f"**{current_mcq['question']}**")
                
                # Create a button to read the question aloud
                question_text = current_mcq['question']
                options_text = ". ".join([f"Option {option}: {text}" for option, text in current_mcq['options'].items()])
                full_text = f"{question_text}. {options_text}"
                
                # Add a "Speak Question" button with JavaScript to read the question aloud
                # Escape single quotes properly for JavaScript
                safe_text = full_text.replace("'", r"\'")
                html_button = f"""
                <button onclick="speakText('{safe_text}')">
                    🔊 Read Question Aloud
                </button>
                """
                st.markdown(html_button, unsafe_allow_html=True)
                
                # Display answer options
                user_answer = st.radio(
                    "Select your answer:",
                    list(current_mcq['options'].keys()),
                    format_func=lambda x: f"{x}: {current_mcq['options'][x]}"
                )
                
                # Check answer button
                if st.button("Check Answer"):
                    st.session_state.user_answer = user_answer
                    is_correct = evaluate_answer(user_answer, current_mcq['correct_answer'])
                    
                    if is_correct:
                        st.success("Correct! 🎉")
                    else:
                        st.error(f"Incorrect. The correct answer is {current_mcq['correct_answer']}: {current_mcq['options'][current_mcq['correct_answer']]}")
                    
                    st.markdown(f"**Explanation:** {current_mcq['explanation']}")
                    
                    # Add button to read the explanation aloud
                    explanation_text = f"Explanation: {current_mcq['explanation']}"
                    safe_explanation = explanation_text.replace("'", r"\'")
                    html_explanation_button = f"""
                    <button onclick="speakText('{safe_explanation}')">
                        🔊 Read Explanation Aloud
                    </button>
                    """
                    st.markdown(html_explanation_button, unsafe_allow_html=True)
                    
                    # Record the answer in the progress tracker
                    progress_tracker.record_answer(current_mcq, user_answer, is_correct)
                    
                    # Store the current question index and user answer in session state
                    if 'last_answered_index' not in st.session_state:
                        st.session_state.last_answered_index = st.session_state.current_mcq_index
                    else:
                        st.session_state.last_answered_index = st.session_state.current_mcq_index
                
                # Show navigation buttons (always visible)
                col1, col2 = st.columns(2)
                
                if col1.button("Previous Question", disabled=(st.session_state.current_mcq_index == 0)):
                    st.session_state.current_mcq_index = max(0, st.session_state.current_mcq_index - 1)
                    st.session_state.user_answer = None
                    st.rerun()
                
                # Next button is always visible
                if col2.button("Next Question", disabled=(st.session_state.current_mcq_index == len(st.session_state.current_mcqs) - 1)):
                    st.session_state.current_mcq_index = min(len(st.session_state.current_mcqs) - 1, st.session_state.current_mcq_index + 1)
                    st.session_state.user_answer = None
                    st.rerun()

# Assessment mode
elif app_mode == "Assessment":
    st.header("Knowledge Assessment")
    
    if not st.session_state.extracted_text:
        st.warning("Please upload a document in the 'Upload & Extract' section first.")
    else:
        if not st.session_state.show_question or st.session_state.learning_mode != "assessment":
            # Start a new assessment
            st.markdown("Start an assessment to test your knowledge of the concepts.")
            
            # Allow selection of specific topics or use all concepts
            topic_options = ["All Topics"] + list(st.session_state.categorized_concepts.keys())
            selected_topic = st.selectbox("Select Topic", topic_options)
            
            if st.button("Start Assessment"):
                # Determine which concepts to use
                assessment_concepts = []
                
                if selected_topic == "All Topics":
                    # Use all concepts
                    assessment_concepts = st.session_state.key_concepts
                else:
                    # Use concepts from the selected topic
                    assessment_concepts = st.session_state.categorized_concepts.get(selected_topic, [])
                
                # Include weak concepts that need reinforcement
                weak_concepts = progress_tracker.get_weak_concepts()
                
                # Prioritize weak concepts but keep the total number as selected
                priority_concepts = list(set(weak_concepts) & set(assessment_concepts))
                other_concepts = list(set(assessment_concepts) - set(priority_concepts))
                
                # Shuffle and select concepts
                random.shuffle(priority_concepts)
                random.shuffle(other_concepts)
                
                # Get the number of questions from sidebar
                num_questions = min(st.session_state.get('num_questions', 10), len(assessment_concepts))
                
                # Determine how many to take from each list
                priority_count = min(len(priority_concepts), num_questions // 2)
                other_count = min(len(other_concepts), num_questions - priority_count)
                
                selected_concepts = priority_concepts[:priority_count] + other_concepts[:other_count]
                
                if selected_concepts:
                    with st.spinner("Generating assessment questions..."):
                        mcqs = generate_mcqs_batch(
                            selected_concepts,
                            st.session_state.extracted_text,
                            num_questions=len(selected_concepts),
                            difficulty_level=st.session_state.difficulty_level
                        )
                        
                        if mcqs:
                            # Shuffle questions to randomize order
                            random.shuffle(mcqs)
                            
                            st.session_state.current_mcqs = mcqs
                            st.session_state.current_mcq_index = 0
                            st.session_state.show_question = True
                            st.session_state.learning_mode = "assessment"
                            st.rerun()
                        else:
                            st.error("Failed to generate assessment questions. Please try again.")
                else:
                    st.error("No concepts available for assessment. Please upload a document with more content.")
        else:
            # Display the current assessment question
            if st.session_state.current_mcqs and 0 <= st.session_state.current_mcq_index < len(st.session_state.current_mcqs):
                current_mcq = st.session_state.current_mcqs[st.session_state.current_mcq_index]
                
                # Progress indicator
                st.progress((st.session_state.current_mcq_index) / len(st.session_state.current_mcqs))
                
                # Question information
                st.subheader(f"Question {st.session_state.current_mcq_index + 1} of {len(st.session_state.current_mcqs)}")
                st.markdown(f"**{current_mcq['question']}**")
                
                # Create a button to read the question aloud
                question_text = current_mcq['question']
                options_text = ". ".join([f"Option {option}: {text}" for option, text in current_mcq['options'].items()])
                full_text = f"{question_text}. {options_text}"
                
                # Add a "Speak Question" button with JavaScript to read the question aloud
                # Escape single quotes properly for JavaScript
                safe_text = full_text.replace("'", r"\'")
                html_button = f"""
                <button onclick="speakText('{safe_text}')">
                    🔊 Read Question Aloud
                </button>
                """
                st.markdown(html_button, unsafe_allow_html=True)
                
                # Display answer options
                user_answer = st.radio(
                    "Select your answer:",
                    list(current_mcq['options'].keys()),
                    format_func=lambda x: f"{x}: {current_mcq['options'][x]}"
                )
                
                # Submit answer button
                if st.button("Submit Answer"):
                    st.session_state.user_answer = user_answer
                    is_correct = evaluate_answer(user_answer, current_mcq['correct_answer'])
                    
                    if is_correct:
                        st.success("Correct! 🎉")
                    else:
                        st.error(f"Incorrect. The correct answer is {current_mcq['correct_answer']}: {current_mcq['options'][current_mcq['correct_answer']]}")
                    
                    # Show explanation
                    st.markdown(f"**Explanation:** {current_mcq['explanation']}")
                    
                    # Add button to read the explanation aloud
                    explanation_text = f"Explanation: {current_mcq['explanation']}"
                    safe_explanation = explanation_text.replace("'", r"\'")
                    html_explanation_button = f"""
                    <button onclick="speakText('{safe_explanation}')">
                        🔊 Read Explanation Aloud
                    </button>
                    """
                    st.markdown(html_explanation_button, unsafe_allow_html=True)
                    
                    # Record the answer in the progress tracker
                    progress_tracker.record_answer(current_mcq, user_answer, is_correct)
                    
                    # Store the current question index and user answer in session state
                    if 'last_answered_index' not in st.session_state:
                        st.session_state.last_answered_index = st.session_state.current_mcq_index
                    else:
                        st.session_state.last_answered_index = st.session_state.current_mcq_index
                
                # Navigation buttons (always visible)
                col1, col2 = st.columns(2)
                
                # Previous button
                if col1.button("Previous Question", key="prev_assessment", disabled=(st.session_state.current_mcq_index == 0)):
                    st.session_state.current_mcq_index = max(0, st.session_state.current_mcq_index - 1)
                    st.session_state.user_answer = None
                    st.rerun()
                
                # Next button or complete assessment button
                if st.session_state.current_mcq_index < len(st.session_state.current_mcqs) - 1:
                    if col2.button("Next Question", key="next_assessment"):
                        st.session_state.current_mcq_index += 1
                        st.session_state.user_answer = None
                        st.rerun()
                else:
                    # Assessment completed
                    if col2.button("Complete Assessment"):
                        st.success("Assessment completed! View your results in the 'Progress Tracking' section.")
                        # Give option to view results
                        if st.button("View Results"):
                            app_mode = "Progress Tracking"
                            st.session_state.show_question = False
                            st.rerun()
            
            # Option to end assessment
            if st.button("End Assessment", key="end_assessment"):
                st.session_state.show_question = False
                st.session_state.learning_mode = "explore"
                st.rerun()

# Progress Tracking mode
elif app_mode == "Progress Tracking":
    st.header("Progress Tracking")
    
    if not st.session_state.progress_data.empty:
        # Summary stats
        summary = progress_tracker.get_performance_summary()
        
        # Display summary in columns
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric("Total Questions Answered", summary['total_questions'])
        
        with col2:
            st.metric("Correct Answers", summary['correct_answers'])
        
        with col3:
            st.metric("Accuracy", f"{summary['accuracy']:.1f}%")
        
        # Second row of metrics
        col1, col2 = st.columns(2)
        
        with col1:
            st.metric("Concepts Mastered", summary['mastered_concepts'])
        
        with col2:
            st.metric("Concepts Needing Work", summary['weak_concepts'])
        
        # Progress chart
        st.subheader("Concept Mastery Progress")
        
        chart_image = progress_tracker.generate_progress_chart()
        if chart_image:
            st.image(f"data:image/png;base64,{chart_image}", use_column_width=True)
        else:
            st.info("Not enough data to generate a progress chart yet.")
        
        # Detailed progress data
        with st.expander("View Detailed Progress Data"):
            st.dataframe(st.session_state.progress_data)
        
        # Weak concepts that need reinforcement
        weak_concepts = progress_tracker.get_weak_concepts()
        if weak_concepts:
            st.subheader("Concepts Needing Reinforcement")
            st.write(", ".join(weak_concepts))
            
            if st.button("Generate Practice Questions for Weak Concepts"):
                with st.spinner("Generating practice questions..."):
                    practice_mcqs = generate_mcqs_batch(
                        weak_concepts,
                        st.session_state.extracted_text,
                        num_questions=len(weak_concepts),
                        difficulty_level=st.session_state.difficulty_level
                    )
                    
                    if practice_mcqs:
                        st.session_state.current_mcqs = practice_mcqs
                        st.session_state.current_mcq_index = 0
                        st.session_state.show_question = True
                        st.session_state.learning_mode = "assessment"
                        st.rerun()
                    else:
                        st.error("Failed to generate practice questions. Please try again.")
        
        # Option to reset tracking data
        if st.button("Reset Learning Session"):
            progress_tracker.reset_session()
            st.success("Learning session reset successfully. Your progress history has been preserved.")
            st.rerun()
    else:
        st.info("No progress data available yet. Complete some assessments to see your progress.")

# Footer
st.markdown("---")
st.markdown("AI Adaptive Learning System | Powered by Streamlit and SpaCy")