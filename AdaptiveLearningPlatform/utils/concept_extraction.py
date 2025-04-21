import spacy
import streamlit as st
from collections import Counter
import re
import os

# Load SpaCy model
@st.cache_resource
def load_spacy_model():
    """
    Load the SpaCy model with caching to improve performance.
    
    Returns:
        spacy model: Loaded SpaCy model
    """
    try:
        # Load English model
        return spacy.load("en_core_web_sm")
    except OSError:
        # If model not found, download it
        st.info("Downloading SpaCy model. This may take a moment...")
        os.system("python -m spacy download en_core_web_sm")
        return spacy.load("en_core_web_sm")

def extract_key_concepts(text, max_concepts=30):
    """
    Extract key concepts from text using SpaCy.
    
    Args:
        text (str): The preprocessed text
        max_concepts (int): Maximum number of concepts to extract
    
    Returns:
        list: List of key concepts
    """
    nlp = load_spacy_model()
    
    # Process text with SpaCy
    doc = nlp(text)
    
    # Extract noun phrases as concepts
    noun_phrases = [chunk.text.lower() for chunk in doc.noun_chunks if len(chunk.text.split()) > 1]
    
    # Extract named entities
    entities = [ent.text.lower() for ent in doc.ents if ent.label_ in ['ORG', 'PERSON', 'GPE', 'LOC', 'PRODUCT', 'EVENT', 'WORK_OF_ART', 'LAW']]
    
    # Extract important terms based on POS tags (nouns, proper nouns)
    important_terms = [token.text.lower() for token in doc if token.pos_ in ['NOUN', 'PROPN'] and len(token.text) > 3]
    
    # Combine all potential concepts
    all_concepts = noun_phrases + entities + important_terms
    
    # Count concept frequency
    concept_counter = Counter(all_concepts)
    
    # Remove concepts that are substrings of others
    filtered_concepts = []
    
    # Sort concepts by length (descending) to prioritize longer phrases
    sorted_concepts = sorted(concept_counter.keys(), key=len, reverse=True)
    
    for concept in sorted_concepts:
        # Check if this concept is a substring of any already filtered concept
        if not any(concept in filtered_concept and concept != filtered_concept for filtered_concept in filtered_concepts):
            filtered_concepts.append(concept)
    
    # Get top concepts by frequency
    top_concepts = [concept for concept, _ in concept_counter.most_common(max_concepts)]
    
    # Filter out any concept that's less than 3 characters
    top_concepts = [concept for concept in top_concepts if len(concept) > 3]
    
    return top_concepts[:max_concepts]

def categorize_concepts(concepts, text):
    """
    Categorize concepts into topics based on co-occurrence.
    
    Args:
        concepts (list): List of extracted concepts
        text (str): The original text
    
    Returns:
        dict: Dictionary mapping topics to related concepts
    """
    # Simple categorization based on basic regex patterns
    topics = {}
    current_topic = "General"
    topics[current_topic] = []
    
    # Look for typical section headers in educational materials
    section_headers = re.finditer(r'(?:\n|\r|^)(#+\s*|)([A-Z][A-Za-z\s]{3,}:?|[A-Z][A-Z\s]{3,}:?)(?:\n|\r|$)', text)
    
    last_position = 0
    
    for match in section_headers:
        header_text = match.group(2).strip()
        position = match.start()
        
        # Add concepts from previous section
        section_text = text[last_position:position]
        section_concepts = [c for c in concepts if c.lower() in section_text.lower()]
        
        if section_concepts:
            if current_topic not in topics:
                topics[current_topic] = []
            topics[current_topic].extend(section_concepts)
        
        # Set new topic
        current_topic = header_text.rstrip(':')
        last_position = position
    
    # Add any remaining concepts
    section_text = text[last_position:]
    section_concepts = [c for c in concepts if c.lower() in section_text.lower()]
    if section_concepts:
        if current_topic not in topics:
            topics[current_topic] = []
        topics[current_topic].extend(section_concepts)
    
    # Remove duplicates in each topic
    for topic in topics:
        topics[topic] = list(set(topics[topic]))
    
    return topics
