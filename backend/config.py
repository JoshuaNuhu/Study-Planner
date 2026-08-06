import os
from datetime import timedelta
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-jwt-secret-key')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,  # Verifies connection is alive before using it
        "pool_recycle": 300,    # Refreshes connections every 5 minutes
    }
    # Supabase Storage
    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

    # AI
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')