from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Event

events_bp = Blueprint('events', __name__)

@events_bp.route('', methods=['GET'])
@jwt_required()
def get_events():
    user_id = int(get_jwt_identity())
    user_events = Event.query.filter_by(user_id=user_id).order_by(Event.event_date.asc()).all()
    
    return jsonify([{
        "id": e.id,
        "title": e.title,
        "event_date": e.event_date.isoformat(),
        "type": e.type,
        "notify_before": e.notify_before
    } for e in user_events]), 200


@events_bp.route('', methods=['POST'])
@jwt_required()
def create_event():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    raw_date = data.get('event_date')
    if not raw_date:
        return jsonify({"error": "event_date is required"}), 400

    # 1. Parse JavaScript ISO string safely (converts trailing 'Z' to '+00:00')
    try:
        clean_date_str = raw_date.replace('Z', '+00:00')
        event_date = datetime.fromisoformat(clean_date_str)
    except ValueError:
        return jsonify({"error": "Valid event_date in ISO format is required"}), 400

    # 2. Safe casting for notify_before
    try:
        notify_before = int(data.get('notify_before', 30))
    except (ValueError, TypeError):
        notify_before = 30

    # 3. Dynamic type handling (stores 'class', 'exams', 'test', or custom text string)
    event_type = str(data.get('type', 'class')).strip().lower()

    event = Event(
        user_id=user_id,
        title=data.get('title', 'Study Event').strip(),
        event_date=event_date,
        type=event_type,
        notify_before=notify_before,
        expo_push_token=data.get('expo_push_token')
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({"message": "Event scheduled", "event_id": event.id}), 201


@events_bp.route('/<int:event_id>', methods=['DELETE'])
@jwt_required()
def delete_event(event_id):
    user_id = int(get_jwt_identity())
    event = Event.query.filter_by(id=event_id, user_id=user_id).first()
    
    if not event:
        return jsonify({"error": "Event not found or access denied"}), 404

    db.session.delete(event)
    db.session.commit()
    return jsonify({"message": "Event deleted successfully"}), 200