from datetime import datetime, timezone
from app.extensions import db, bcrypt

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Cascade deletes: if a user is deleted, all their data goes with them
    handouts = db.relationship('Handout', backref='user', lazy=True, cascade='all, delete-orphan')
    attempts = db.relationship('Attempt', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password: str):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)


class Handout(db.Model):
    __tablename__ = 'handouts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    course_name = db.Column(db.String(150), nullable=False)
    file_url = db.Column(db.String(500), nullable=True) # Holds Supabase Storage URL
    extracted_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    questions = db.relationship('Question', backref='handout', lazy=True, cascade='all, delete-orphan')
    mastery = db.relationship('Mastery', backref='handout', uselist=False, cascade='all, delete-orphan')


class Question(db.Model):
    __tablename__ = 'questions'

    id = db.Column(db.Integer, primary_key=True)
    handout_id = db.Column(db.Integer, db.ForeignKey('handouts.id'), nullable=False, index=True)
    question_text = db.Column(db.Text, nullable=False)
    options = db.Column(db.JSON, nullable=True)  # Stores multiple choice options list
    correct_answer = db.Column(db.Text, nullable=False)
    topic_tag = db.Column(db.String(100), nullable=True)

    attempts = db.relationship('Attempt', backref='question', lazy=True, cascade='all, delete-orphan')


class Attempt(db.Model):
    __tablename__ = 'attempts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False, index=True)
    student_answer = db.Column(db.Text, nullable=False)
    is_correct = db.Column(db.Boolean, nullable=False)
    conceptual_flag = db.Column(db.Boolean, default=False)
    explanation = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class Mastery(db.Model):
    __tablename__ = 'mastery'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    handout_id = db.Column(db.Integer, db.ForeignKey('handouts.id'), nullable=False, index=True)
    score = db.Column(db.Float, default=0.0) 
    last_reviewed_date = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class XPStreak(db.Model):
    __tablename__ = 'xp_streaks'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True, unique=True)
    xp_total = db.Column(db.Integer, default=0)
    streak_count = db.Column(db.Integer, default=0)
    last_active_date = db.Column(db.Date, nullable=True)


class Event(db.Model):
    __tablename__ = 'events'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    event_date = db.Column(db.DateTime, nullable=False)
    type = db.Column(db.String(50), nullable=False) 
    notify_before = db.Column(db.Integer, default=30)
    expo_push_token = db.Column(db.String(255), nullable=True)
    notified = db.Column(db.Boolean, default=False)