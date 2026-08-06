# app/utils/pdf.py
import io
import pdfplumber

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Reads a PDF file stream and extracts all text."""
    extracted_text = ""
    
    # We use io.BytesIO to read the file directly from memory 
    # without needing to save it to the server's hard drive first
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"
                
    if not extracted_text.strip():
        raise ValueError("Could not extract any text from the provided PDF.")
        
    return extracted_text.strip()