# app/__init__.py

import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from app.extensions import db, bcrypt, jwt, scheduler

load_dotenv()

def create_app():
    app = Flask(__name__)

    # --- Configuration ---
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')
    app.config['GEMINI_API_KEY'] = os.environ.get('GEMINI_API_KEY')

    # --- Initialize extensions ---
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    # --- Enable CORS so the mobile app / Postman can reach this from other devices ---
    CORS(app)

    # --- Register blueprints ---
    from app.routes.auth import auth_bp
    from app.routes.handouts import handouts_bp

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(handouts_bp, url_prefix='/handouts')

    # --- Scheduler (if used for reminders/notifications) ---
    # if not scheduler.running:
    #     scheduler.start()

    return app