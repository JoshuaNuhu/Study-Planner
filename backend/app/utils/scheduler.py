import datetime
import requests
from flask import current_app

def send_expo_push_notification(push_token: str, title: str, message: str):
    """Sends a push notification via Expo's Push API."""
    if not push_token or not push_token.startswith("ExponentPushToken"):
        return

    payload = {
        "to": push_token,
        "sound": "default",
        "title": title,
        "body": message
    }
    try:
        requests.post("https://exp.host/--/api/v2/push/send", json=payload, timeout=5)
    except Exception as e:
        print(f"Failed to send push notification: {e}")


def check_and_send_event_reminders(app):
    """Periodic job that runs inside Flask app context to push event reminders."""
    with app.app_context():
        from app.models import Event
        from app.extensions import db

        now = datetime.datetime.now(datetime.timezone.utc)
        
        # Find pending notifications due within their notify_before window
        pending_events = Event.query.filter_by(notified=False).all()

        for event in pending_events:
            # Match UTC offset
            event_time = event.event_date.replace(tzinfo=datetime.timezone.utc)
            notify_time = event_time - datetime.timedelta(minutes=event.notify_before)

            if now >= notify_time and event.expo_push_token:
                title = f"Upcoming {event.type.capitalize()}: {event.title}"
                body = f"Reminder: Your {event.type} starts at {event.event_date.strftime('%I:%M %p')}!"
                
                send_expo_push_notification(event.expo_push_token, title, body)
                event.notified = True
                db.session.commit()