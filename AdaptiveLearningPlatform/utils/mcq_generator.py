import os
import json
import random
import streamlit as st
import spacy
import traceback
import re
from collections import Counter

# Load spaCy model
@st.cache_resource
def load_spacy_model():
    """
    Load the SpaCy model with caching to improve performance.
    
    Returns:
        spacy model: Loaded SpaCy model
    """
    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        # If model not found, download it
        st.info("Downloading SpaCy model. This may take a moment...")
        os.system("python -m spacy download en_core_web_sm")
        return spacy.load("en_core_web_sm")

# Use spaCy for MCQ generation when no API key is available
# No need for OpenAI with this approach

def extract_sentences_with_concept(concept, text):
    """
    Extract sentences that contain the concept from text
    
    Args:
        concept (str): The concept to find in sentences
        text (str): The text to search
        
    Returns:
        list: List of sentences containing the concept
    """
    # Simple sentence splitting
    sentences = re.split(r'(?<=[.!?])\s+', text)
    
    # Find sentences containing the concept (case insensitive)
    concept_sentences = []
    concept_lower = concept.lower()
    for sentence in sentences:
        if concept_lower in sentence.lower():
            concept_sentences.append(sentence.strip())
    
    return concept_sentences

def find_related_terms(concept, text, nlp=None):
    """
    Find terms related to the concept in the text
    
    Args:
        concept (str): The concept to find related terms for
        text (str): The text to analyze
        nlp: spaCy NLP model
        
    Returns:
        list: List of related terms
    """
    if nlp is None:
        nlp = load_spacy_model()
    
    # Get sentences containing the concept
    concept_sentences = extract_sentences_with_concept(concept, text)
    
    if not concept_sentences:
        return []
    
    # Process sentences with spaCy
    related_terms = []
    for sentence in concept_sentences:
        doc = nlp(sentence)
        
        # Extract nouns and named entities
        for token in doc:
            if token.pos_ in ['NOUN', 'PROPN'] and token.text.lower() != concept.lower():
                related_terms.append(token.text.lower())
        
        # Add named entities
        for ent in doc.ents:
            if ent.text.lower() != concept.lower():
                related_terms.append(ent.text.lower())
    
    # Count frequencies and get top related terms
    term_counter = Counter(related_terms)
    top_terms = [term for term, count in term_counter.most_common(10)]
    
    return top_terms

def generate_mcq_for_concept(concept, context_text, difficulty_level="medium"):
    """
    Generate MCQ for a specific concept using spaCy-based approach
    
    Args:
        concept (str): The concept to generate a question about
        context_text (str): Context information about the concept
        difficulty_level (str): Difficulty level (easy, medium, hard)
    
    Returns:
        dict: Dictionary containing the generated MCQ
    """
    try:
        st.info(f"Generating MCQ for concept: {concept}")
        
        # Load spaCy model
        nlp = load_spacy_model()
        
        # Get sentences containing the concept
        concept_sentences = extract_sentences_with_concept(concept, context_text)
        
        if not concept_sentences:
            st.warning(f"No sentences found containing concept: {concept}")
            return None
        
        # Select a sentence based on difficulty
        # More complex sentences for higher difficulty
        sentences_by_length = sorted(concept_sentences, key=len)
        
        if difficulty_level == "easy":
            # Short, simple sentences
            target_sentences = sentences_by_length[:max(1, len(sentences_by_length)//3)]
        elif difficulty_level == "hard":
            # Longer, more complex sentences
            target_sentences = sentences_by_length[-(len(sentences_by_length)//3):]
        else:  # medium
            # Medium length sentences
            start_idx = len(sentences_by_length)//3
            end_idx = start_idx + len(sentences_by_length)//3
            target_sentences = sentences_by_length[start_idx:end_idx]
        
        # Select a random sentence from the appropriate difficulty level
        if not target_sentences:
            target_sentences = concept_sentences
        sentence = random.choice(target_sentences)
        
        # Process with spaCy to analyze
        doc = nlp(sentence)
        
        # Generate question based on pattern matching
        question = ""
        
        # Find if concept is a named entity
        is_entity = False
        entity_label = ""
        for ent in doc.ents:
            if concept.lower() in ent.text.lower():
                is_entity = True
                entity_label = ent.label_
                break
        
        # Different question patterns
        question_patterns = [
            f"Which of the following best describes {concept}?",
            f"What is the primary characteristic of {concept}?",
            f"How would you define {concept} based on the text?",
            f"What is {concept} primarily concerned with?"
        ]
        
        if is_entity:
            if entity_label in ["ORG", "PRODUCT"]:
                question_patterns.extend([
                    f"What is {concept}?",
                    f"Which of the following statements about {concept} is correct?"
                ])
            elif entity_label in ["PERSON"]:
                question_patterns.extend([
                    f"Who is {concept}?",
                    f"What is {concept} known for?"
                ])
        
        # Select a question pattern
        question = random.choice(question_patterns)
        
        # Extract key information as the correct answer from the sentence
        correct_info = sentence.replace(concept, "___")
        
        # Find related terms for distractors
        related_terms = find_related_terms(concept, context_text, nlp)
        
        # Generate options - including one correct and three distractors
        correct_option = sentence
        if len(correct_option) > 100:  # Truncate if too long
            correct_option = correct_option[:100] + "..."
        
        # Create distractors by using related terms
        distractors = []
        
        # Process sentences not containing the concept to create distractors
        other_sentences = [s for s in re.split(r'(?<=[.!?])\s+', context_text) 
                         if s not in concept_sentences and len(s) > 20]
        
        if other_sentences and related_terms:
            for _ in range(min(6, len(other_sentences))):
                if not other_sentences:
                    break
                    
                distractor_sentence = random.choice(other_sentences)
                other_sentences.remove(distractor_sentence)
                
                if len(distractor_sentence) > 100:  # Truncate if too long
                    distractor_sentence = distractor_sentence[:100] + "..."
                
                distractors.append(distractor_sentence)
        
        # If not enough distractors, create some generic ones
        while len(distractors) < 3:
            generic_distractors = [
                f"{concept} is a minor concept with little relevance to the main topic.",
                f"{concept} refers to an outdated theory no longer in use.",
                f"{concept} is primarily used in fields unrelated to this subject.",
                f"The text does not provide significant information about {concept}."
            ]
            
            for generic in generic_distractors:
                if generic not in distractors:
                    distractors.append(generic)
                    break
        
        # Ensure we have exactly 3 distractors
        distractors = distractors[:3]
        
        # Shuffle the distractors
        random.shuffle(distractors)
        
        # Create the options
        options = {}
        choices = ["A", "B", "C", "D"]
        correct_position = random.randint(0, 3)
        correct_answer = choices[correct_position]  # Initialize the correct answer
        
        for i in range(4):
            if i == correct_position:
                options[choices[i]] = correct_option
            else:
                distractor_index = i if i < correct_position else i - 1
                if distractor_index < len(distractors):
                    options[choices[i]] = distractors[distractor_index]
                else:
                    # Fallback in case we don't have enough distractors
                    options[choices[i]] = f"Not enough information about {concept} is provided in the text."
        
        # Create explanation
        explanation = f"This answer correctly identifies information about {concept} as stated in the text."
        
        # Assemble MCQ data
        mcq_data = {
            "question": question,
            "options": options,
            "correct_answer": correct_answer,
            "explanation": explanation,
            "concept": concept
        }
        
        return mcq_data
        
    except Exception as e:
        error_details = traceback.format_exc()
        st.error(f"Error generating MCQ: {str(e)}")
        st.error(f"Traceback: {error_details}")
        return None

def generate_mcqs_batch(concepts, context_text, num_questions=5, difficulty_level="medium"):
    """
    Generate multiple MCQs for a list of concepts
    
    Args:
        concepts (list): List of concepts to generate questions for
        context_text (str): Context information
        num_questions (int): Number of questions to generate
        difficulty_level (str): Difficulty level
    
    Returns:
        list: List of generated MCQs
    """
    try:
        if not concepts:
            st.warning("No concepts provided for MCQ generation")
            return []
        
        st.info(f"Starting MCQ generation for {len(concepts)} concepts with difficulty: {difficulty_level}")
        
        # Limit to requested number of questions
        selected_concepts = concepts[:num_questions] if len(concepts) > num_questions else concepts
        st.info(f"Selected {len(selected_concepts)} concepts for question generation")
        
        # Generate MCQs for selected concepts
        mcqs = []
        successful = 0
        failed = 0
        
        with st.spinner("Generating multiple-choice questions..."):
            progress_bar = st.progress(0)
            for i, concept in enumerate(selected_concepts):
                try:
                    st.info(f"Processing concept {i+1}/{len(selected_concepts)}: {concept}")
                    mcq = generate_mcq_for_concept(concept, context_text, difficulty_level)
                    if mcq:
                        mcqs.append(mcq)
                        successful += 1
                    else:
                        failed += 1
                        st.error(f"Failed to generate MCQ for concept: {concept}")
                except Exception as e:
                    failed += 1
                    st.error(f"Error generating MCQ for concept '{concept}': {str(e)}")
                
                # Update progress
                progress_bar.progress((i + 1) / len(selected_concepts))
        
        # Summary report
        if successful > 0:
            st.success(f"Successfully generated {successful} MCQs")
        if failed > 0:
            st.warning(f"Failed to generate {failed} MCQs")
        
        return mcqs
    
    except Exception as e:
        error_details = traceback.format_exc()
        st.error(f"Error in batch MCQ generation: {str(e)}")
        st.error(f"Traceback: {error_details}")
        return []

def evaluate_answer(user_answer, correct_answer):
    """
    Evaluate if the user's answer is correct
    
    Args:
        user_answer (str): The user's selected answer
        correct_answer (str): The correct answer
    
    Returns:
        bool: True if the answer is correct, False otherwise
    """
    return user_answer == correct_answer
