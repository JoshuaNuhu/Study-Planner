from datetime import datetime, date, timedelta, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Handout, Question, Attempt, Mastery, XPStreak
from app.utils.ai import generate_study_questions, evaluate_student_answer

questions_bp = Blueprint('questions', __name__)

@questions_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_questions():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    handout_id = data.get('handout_id')

    # Security: Verify handout exists AND belongs to the authenticated user
    handout = Handout.query.filter_by(id=handout_id, user_id=user_id).first()
    if not handout:
        return jsonify({"error": "Handout not found or access denied"}), 404

    raw_questions = generate_study_questions(handout.extracted_text)
    saved_questions = []

    for q in raw_questions:
        question = Question(
            handout_id=handout.id,
            question_text=q['question_text'],
            correct_answer=q['correct_answer'],
            topic_tag=q.get('topic_tag', 'General')
        )
        db.session.add(question)
        saved_questions.append(question)

    db.session.commit()

    return jsonify([{
        "id": q.id,
        "question_text": q.question_text,
        "topic_tag": q.topic_tag
    } for q in saved_questions]), 201


@questions_bp.route('/evaluate', methods=['POST'])
@jwt_required()
def evaluate_answer():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    question_id = data.get('question_id')
    student_answer = data.get('student_answer', '').strip()

    question = Question.query.get(question_id)
    if not question or question.handout.user_id != user_id:
        return jsonify({"error": "Question not found or access denied"}), 404

    # 1. Evaluate answer using AI
    eval_result = evaluate_student_answer(
        question_text=question.question_text,
        correct_answer=question.correct_answer,
        student_answer=student_answer
    )

    # 2. Record Attempt
    attempt = Attempt(
        user_id=user_id,
        question_id=question.id,
        student_answer=student_answer,
        is_correct=eval_result['is_correct'],
        conceptual_flag=eval_result.get('conceptual_flag', False),
        explanation=eval_result.get('explanation', '')
    )
    db.session.add(attempt)

    # 3. Update Mastery Score with daily linear decay check
    mastery = Mastery.query.filter_by(user_id=user_id, handout_id=question.handout_id).first()
    if mastery:
        now = datetime.now(timezone.utc)
        days_passed = (now - mastery.last_reviewed_date.replace(tzinfo=timezone.utc)).days
        
        # Linear decay: decrease score by 2.0 points per unreviewed day
        if days_passed > 0:
            mastery.score = max(0.0, mastery.score - (days_passed * 2.0))
        
        # Increase score on correct answer (+10 points up to max 100)
        if eval_result['is_correct']:
            mastery.score = min(100.0, mastery.score + 10.0)
            
        mastery.last_reviewed_date = now

    # 4. Update XP and Streak
    xp_record = XPStreak.query.filter_by(user_id=user_id).first()
    if not xp_record:
        xp_record = XPStreak(user_id=user_id, xp_total=0, streak_count=0)
        db.session.add(xp_record)

    today = date.today()
    if eval_result['is_correct']:
        xp_record.xp_total += 15  # +15 XP per correct answer

    # Streak logic (consecutive active days)
    if xp_record.last_active_date != today:
        if xp_record.last_active_date == today - timedelta(days=1):
            xp_record.streak_count += 1
        else:
            xp_record.streak_count = 1
        xp_record.last_active_date = today

    db.session.commit()

    return jsonify({
        "is_correct": eval_result['is_correct'],
        "conceptual_flag": eval_result.get('conceptual_flag', False),
        "explanation": eval_result.get('explanation', ''),
        "current_mastery": round(mastery.score, 1) if mastery else 0.0,
        "xp_total": xp_record.xp_total,
        "streak_count": xp_record.streak_count
    }), 200