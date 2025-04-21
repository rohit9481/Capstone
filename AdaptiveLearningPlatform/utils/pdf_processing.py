import io
import fitz  # PyMuPDF
import spacy
import os
import tempfile
import streamlit as st

def extract_text_from_pdf(pdf_file):
    """
    Extract text from PDF file using PyMuPDF.
    
    Args:
        pdf_file: The uploaded PDF file object
    
    Returns:
        str: Extracted text from the PDF
    """
    try:
        # Create a temporary file to store the PDF content
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_file.write(pdf_file.getvalue())
            temp_file_path = temp_file.name
        
        # Extract text using PyMuPDF
        extracted_text = ""
        doc = fitz.open(temp_file_path)
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            extracted_text += page.get_text()
        
        # Clean up
        doc.close()
        os.unlink(temp_file_path)
        
        return extracted_text
    except Exception as e:
        st.error(f"Error extracting text from PDF: {str(e)}")
        return ""

def preprocess_text(text):
    """
    Preprocess the extracted text by removing extra whitespaces and line breaks.
    
    Args:
        text (str): The extracted text from PDF
    
    Returns:
        str: Preprocessed text
    """
    # Remove extra whitespaces and normalize line breaks
    import re
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\n+', '\n', text)
    return text.strip()

def split_text_into_chunks(text, max_chunk_size=4000):
    """
    Split the text into smaller chunks for processing.
    
    Args:
        text (str): The text to split
        max_chunk_size (int): Maximum size of each chunk
    
    Returns:
        list: List of text chunks
    """
    # Split by paragraphs first
    paragraphs = text.split('\n')
    
    chunks = []
    current_chunk = ""
    
    for paragraph in paragraphs:
        # If adding this paragraph would exceed max_chunk_size, 
        # start a new chunk
        if len(current_chunk) + len(paragraph) > max_chunk_size:
            chunks.append(current_chunk)
            current_chunk = paragraph
        else:
            if current_chunk:
                current_chunk += "\n" + paragraph
            else:
                current_chunk = paragraph
    
    # Add the last chunk if not empty
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks
