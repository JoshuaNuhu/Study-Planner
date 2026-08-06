from datetime import datetime, date, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Handout, Mastery, Question, XPStreak, Attempt
from app.utils.pdf import extract_text_from_pdf
from app.utils.storage import upload_pdf_to_supabase, delete_pdf_from_supabase
from app.utils.ai import generate_study_questions

handouts_bp = Blueprint('handouts', __name__)

@handouts_bp.route('', methods=['POST'])
@jwt_required()
def upload_handout():
    user_id = int(get_jwt_identity())
    
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    course_name = request.form.get('course_name', 'General Course')

    if file.filename == '' or not file.filename.endswith('.pdf'):
        return jsonify({"error": "File must be a PDF"}), 400

    file_bytes = file.read()

    try:
        # 1. Extract Text
        extracted_text = extract_text_from_pdf(file_bytes)
        
        # 2. Upload PDF to Supabase Storage
        file_url = upload_pdf_to_supabase(file_bytes, file.filename, user_id)
        
        # 3. Save Handout record to database
        handout = Handout(
            user_id=user_id,
            course_name=course_name,
            extracted_text=extracted_text,
            file_url=file_url
        )
        db.session.add(handout)
        db.session.flush()

        # 4. Generate AI Questions & Store Options
        questions_data = generate_study_questions(extracted_text, num_questions=5)
        
        for q_data in questions_data:
            question = Question(
                handout_id=handout.id,
                question_text=q_data.get('question_text'),
                options=q_data.get('options', []),
                correct_answer=q_data.get('correct_answer'),
                topic_tag=q_data.get('topic_tag', 'General')
            )
            db.session.add(question)
            
        # 5. Initialize Mastery Tracking
        mastery = Mastery(user_id=user_id, handout_id=handout.id, score=0.0)
        db.session.add(mastery)
        
        db.session.commit()

        return jsonify({
            "message": "Handout processed and AI questions generated successfully",
            "handout_id": handout.id,
            "file_url": handout.file_url
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@handouts_bp.route('', methods=['GET'])
@jwt_required()
def list_handouts():
    user_id = int(get_jwt_identity())
    handouts = Handout.query.filter_by(user_id=user_id).order_by(Handout.created_at.desc()).all()
    
    return jsonify([{
        "id": h.id,
        "course_name": h.course_name,
        "file_url": h.file_url,
        "created_at": h.created_at.isoformat()
    } for h in handouts]), 200


@handouts_bp.route('/<int:handout_id>', methods=['GET'])
@jwt_required()
def get_handout(handout_id):
    user_id = int(get_jwt_identity())

    handout = Handout.query.filter_by(id=handout_id, user_id=user_id).first()

    if not handout:
        return jsonify({"error": "Handout not found"}), 404

    questions_data = []
    for q in handout.questions:
        # Fetch the user's latest attempt for this specific question
        latest_attempt = Attempt.query.filter_by(
            user_id=user_id, question_id=q.id
        ).order_by(Attempt.timestamp.desc()).first()

        questions_data.append({
            "id": q.id,
            "question_text": q.question_text,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "topic_tag": q.topic_tag,
            "last_attempt": {
                "student_answer": latest_attempt.student_answer,
                "is_correct": latest_attempt.is_correct
            } if latest_attempt else None
        })

    return jsonify({
        "id": handout.id,
        "course_name": handout.course_name,
        "file_url": handout.file_url,
        "created_at": handout.created_at.isoformat(),
        "questions": questions_data
    }), 200


@handouts_bp.route('/<int:handout_id>/submit', methods=['POST'])
@jwt_required()
def submit_quiz(handout_id):
    """Saves completed quiz performance, records question attempts, and updates Mastery/XP."""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    xp_earned = data.get('xp_earned', 0)
    score = data.get('score', 0)
    total_questions = data.get('total_questions', 0)
    attempts_payload = data.get('attempts', []) # List of {"question_id": int, "student_answer": str}

    handout = Handout.query.filter_by(id=handout_id, user_id=user_id).first()
    if not handout:
        return jsonify({"error": "Handout not found"}), 404

    # 1. Record individual attempts
    for att in attempts_payload:
        q_id = att.get('question_id')
        ans = att.get('student_answer')
        if q_id and ans:
            question = Question.query.filter_by(id=q_id, handout_id=handout.id).first()
            if question:
                is_correct = (ans == question.correct_answer)
                attempt = Attempt(
                    user_id=user_id,
                    question_id=question.id,
                    student_answer=ans,
                    is_correct=is_correct
                )
                db.session.add(attempt)

    # 2. Update or create XPStreak record
    streak = XPStreak.query.filter_by(user_id=user_id).first()
    if not streak:
        streak = XPStreak(user_id=user_id, xp_total=0, streak_count=1, last_active_date=date.today())
        db.session.add(streak)

    streak.xp_total = (streak.xp_total or 0) + xp_earned
    
    today = date.today()
    if streak.last_active_date != today:
        streak.streak_count = (streak.streak_count or 0) + 1
        streak.last_active_date = today

    # 3. Update Mastery percentage
    if total_questions > 0:
        mastery_pct = (score / total_questions) * 100.0
        mastery = Mastery.query.filter_by(handout_id=handout_id, user_id=user_id).first()
        if mastery:
            mastery.score = max(mastery.score or 0.0, mastery_pct)
            mastery.last_reviewed_date = datetime.now(timezone.utc)

    db.session.commit()

    return jsonify({
        "message": "Quiz submitted and attempts recorded!",
        "xp_earned": xp_earned,
        "xp_total": streak.xp_total,
        "streak_count": streak.streak_count
    }), 200


@handouts_bp.route('/<int:handout_id>', methods=['DELETE'])
@jwt_required()
def delete_handout(handout_id):
    """Deletes a handout, removes the PDF from Supabase, and manually cascades deletion to DB dependencies."""
    user_id = int(get_jwt_identity())
    
    handout = Handout.query.filter_by(id=handout_id, user_id=user_id).first()
    if not handout:
        return jsonify({"error": "Handout not found"}), 404

    # 1. Delete PDF file from Supabase bucket
    if handout.file_url:
        delete_pdf_from_supabase(handout.file_url)

    # 2. Prevent Foreign Key Error: Delete attempts linked to this handout's questions first
    questions = Question.query.filter_by(handout_id=handout.id).all()
    question_ids = [q.id for q in questions]
    if question_ids:
        Attempt.query.filter(Attempt.question_id.in_(question_ids)).delete(synchronize_session=False)

    # 3. Delete the questions and mastery records
    Question.query.filter_by(handout_id=handout.id).delete(synchronize_session=False)
    Mastery.query.filter_by(handout_id=handout.id).delete(synchronize_session=False)

    # 4. Finally, delete the main handout record
    db.session.delete(handout)
    db.session.commit()

    return jsonify({"message": "Handout deleted successfully"}), 200


@handouts_bp.route('/<int:handout_id>/generate-questions', methods=['POST'])
@jwt_required()
def generate_new_questions(handout_id):
    """Deletes old questions/attempts for this handout and generates 5 new questions."""
    user_id = int(get_jwt_identity())
    
    handout = Handout.query.filter_by(id=handout_id, user_id=user_id).first()
    if not handout:
        return jsonify({"error": "Handout not found or access denied"}), 404

    if not handout.extracted_text:
        return jsonify({"error": "No extracted text available for this handout"}), 400

    try:
        # 1. Prevent Foreign Key Error: Find old questions and delete their attempts first
        old_questions = Question.query.filter_by(handout_id=handout.id).all()
        old_q_ids = [q.id for q in old_questions]
        if old_q_ids:
            Attempt.query.filter(Attempt.question_id.in_(old_q_ids)).delete(synchronize_session=False)

        # 2. Now it is safe to delete the old questions
        Question.query.filter_by(handout_id=handout.id).delete(synchronize_session=False)
        db.session.commit()

        # 3. Generate the new questions
        questions_data = generate_study_questions(handout.extracted_text, num_questions=5)
        
        new_questions = []
        for q_data in questions_data:
            q = Question(
                handout_id=handout.id,
                question_text=q_data.get('question_text'),
                options=q_data.get('options', []),
                correct_answer=q_data.get('correct_answer'),
                topic_tag=q_data.get('topic_tag', 'General')
            )
            db.session.add(q)
            new_questions.append(q)

        db.session.commit()

        return jsonify([{
            "id": q.id,
            "question_text": q.question_text,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "topic_tag": q.topic_tag
        } for q in new_questions]), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to generate new questions: {str(e)}"}), 500