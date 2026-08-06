# app/utils/ai.py
import requests
import json
from flask import current_app
import urllib3

# Suppress warnings when bypassing local SSL interception
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def generate_study_questions(text: str, num_questions: int = 5) -> list:
    """Sends extracted text to Gemini to generate multiple-choice questions."""
    api_key = current_app.config.get("GEMINI_API_KEY")
    
    if not api_key:
        raise ValueError("Gemini API Key is missing from configuration.")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={api_key}"
    headers = {
        "Content-Type": "application/json"
    }
    
    # Updated prompt to explicitly request four choices and a matching correct answer
    prompt = f"""
    You are an expert academic tutor. Read the following text and generate {num_questions} multiple-choice questions to test the student's knowledge.
    
    Return ONLY a JSON array of objects with the following keys:
    - "question_text" (string)
    - "options" (array of exactly 4 strings containing the choices, e.g., ["A. ...", "B. ...", "C. ...", "D. ..."])
    - "correct_answer" (string, this MUST exactly match one of the strings inside the options array)
    - "topic_tag" (string, a short 1-2 word category)
    
    Text context:
    {text[:10000]} 
    """
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.7,
            "response_mime_type": "application/json" 
        }
    }
    
    response = requests.post(
        url, 
        json=payload, 
        headers=headers, 
        verify=False,
        proxies={"http": None, "https": None}
    )
    
    if response.status_code != 200:
        raise Exception(f"Gemini API error: {response.text}")
        
    response_data = response.json()
    
    try:
        ai_message = response_data['candidates'][0]['content']['parts'][0]['text']
        questions = json.loads(ai_message)
        return questions
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        raise ValueError(f"Failed to parse Gemini response: {str(e)}")


def evaluate_student_answer(question_text: str, correct_answer: str, student_answer: str) -> dict:
    """Uses Gemini to judge whether a student's free-text answer is conceptually correct."""
    api_key = current_app.config.get("GEMINI_API_KEY")

    if not api_key:
        raise ValueError("Gemini API Key is missing from configuration.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}

    prompt = f"""
    You are grading a student's answer to a quiz question.

    Question: {question_text}
    Correct Answer: {correct_answer}
    Student's Answer: {student_answer}

    Judge whether the student's answer is correct, allowing for phrasing differences.
    Return ONLY a JSON object with these keys:
    - "is_correct" (boolean)
    - "conceptual_flag" (boolean, true if the student shows a fundamental misunderstanding rather than a minor slip)
    - "explanation" (string, 1-2 sentences explaining why)
    """

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "response_mime_type": "application/json"
        }
    }

    response = requests.post(
        url,
        json=payload,
        headers=headers,
        verify=False,
        proxies={"http": None, "https": None}
    )

    if response.status_code != 200:
        raise Exception(f"Gemini API error: {response.text}")

    response_data = response.json()

    try:
        ai_message = response_data['candidates'][0]['content']['parts'][0]['text']
        result = json.loads(ai_message)
        return result
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        raise ValueError(f"Failed to parse Gemini response: {str(e)}")