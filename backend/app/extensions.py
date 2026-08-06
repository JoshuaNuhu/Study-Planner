from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from apscheduler.schedulers.background import BackgroundScheduler

db = SQLAlchemy()
jwt = JWTManager()
bcrypt = Bcrypt()
scheduler = BackgroundScheduler()