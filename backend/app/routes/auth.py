from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import User, XPStreak, Handout, Mastery, Question, Attempt
from app.utils.storage import delete_pdf_from_supabase
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

auth_bp = Blueprint('auth', __name__)

def update_user_streak(user_id: int) -> XPStreak:
    """Calculates and updates user streak based on calendar date differences."""
    today = datetime.now(timezone.utc).date()
    streak = XPStreak.query.filter_by(user_id=user_id).first()

    # 1. Create streak record if it doesn't exist yet
    if not streak:
        streak = XPStreak(
            user_id=user_id,
            xp_total=0,
            streak_count=1,
            last_active_date=today
        )
        db.session.add(streak)
        db.session.commit()
        return streak

    # 2. Check last active date against today
    if streak.last_active_date is None:
        streak.streak_count = 1
        streak.last_active_date = today

    elif streak.last_active_date == today:
        # Already logged in today — keep current streak
        pass

    elif streak.last_active_date == today - timedelta(days=1):
        # Consecutive day — increment streak!
        streak.streak_count += 1
        streak.last_active_date = today

    else:
        # Missed a day or more — reset streak to 1
        streak.streak_count = 1
        streak.last_active_date = today

    db.session.commit()
    return streak


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({"error": "Email already exists"}), 400
        
    new_user = User(
        name=data.get('name'), 
        email=data.get('email')
    )
    new_user.set_password(data.get('password'))
    
    db.session.add(new_user)
    db.session.commit()

    # Initialize streak record on registration
    update_user_streak(new_user.id)
    
    return jsonify({"message": "User created successfully"}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    user = User.query.filter_by(email=data.get('email')).first()
    
    if user and user.check_password(data.get('password')):
        # Update daily streak upon successful login
        update_user_streak(user.id)

        access_token = create_access_token(identity=str(user.id))
        return jsonify({"access_token": access_token}), 200
        
    return jsonify({"error": "Invalid credentials"}), 401


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Automatically recalculate/sync streak when profile data is requested
    streak = update_user_streak(user_id)
    
    return jsonify({
        "name": user.name,
        "email": user.email,
        "xp_total": streak.xp_total,
        "streak_count": streak.streak_count
    }), 200


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')

    if name:
        user.name = name
    if email:
        existing = User.query.filter(User.email == email, User.id != user_id).first()
        if existing:
            return jsonify({"error": "Email is already in use"}), 400
        user.email = email

    db.session.commit()
    return jsonify({"message": "Profile updated successfully!", "name": user.name, "email": user.email}), 200


@auth_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not current_password or not new_password:
        return jsonify({"error": "Both current and new password are required"}), 400

    if not user.check_password(current_password):
        return jsonify({"error": "Incorrect current password"}), 400

    user.set_password(new_password)
    db.session.commit()

    return jsonify({"message": "Password updated successfully!"}), 200


@auth_bp.route('/delete-account', methods=['DELETE'])
@jwt_required()
def delete_account():
    """Deletes the user, all their database records, and their Supabase files."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        # 1. Find all user handouts and delete PDFs from Supabase
        handouts = Handout.query.filter_by(user_id=user_id).all()
        handout_ids = []
        for h in handouts:
            handout_ids.append(h.id)
            if h.file_url:
                delete_pdf_from_supabase(h.file_url)

        # 2. Prevent Foreign Key Errors: Delete all child records first
        Attempt.query.filter_by(user_id=user_id).delete(synchronize_session=False)
        Mastery.query.filter_by(user_id=user_id).delete(synchronize_session=False)
        XPStreak.query.filter_by(user_id=user_id).delete(synchronize_session=False)

        # Questions are linked to handouts, so we delete them using the handout_ids
        if handout_ids:
            Question.query.filter(Question.handout_id.in_(handout_ids)).delete(synchronize_session=False)
            
        # 3. Delete the handouts
        Handout.query.filter_by(user_id=user_id).delete(synchronize_session=False)

        # 4. Finally, delete the user record
        db.session.delete(user)
        db.session.commit()

        return jsonify({"message": "Account and all associated data completely deleted."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete account: {str(e)}"}), 500