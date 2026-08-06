from flask import Flask
from config import Config
from app.extensions import db, jwt, bcrypt, scheduler

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)

    # We will uncomment these in the next step when we build the routes!
    from app.routes.auth import auth_bp
    from app.routes.handouts import handouts_bp
    from app.routes.questions import questions_bp
    from app.routes.events import events_bp

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(handouts_bp, url_prefix='/handouts')
    app.register_blueprint(questions_bp, url_prefix='/questions')
    app.register_blueprint(events_bp, url_prefix='/events')

    # Push the context to create the database tables in Supabase
    with app.app_context():
        from app import models
        db.create_all()

    if not scheduler.running:
        scheduler.start()

    return app