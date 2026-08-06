# app/utils/storage.py
import uuid
from supabase import create_client, Client
from flask import current_app

def upload_pdf_to_supabase(file_bytes: bytes, filename: str, user_id: int) -> str:
    """Uploads a PDF to Supabase Storage and returns the public URL."""
    url = current_app.config.get("SUPABASE_URL")
    key = current_app.config.get("SUPABASE_KEY")
    
    if not url or not key:
        raise ValueError("Supabase URL or Key is missing from configuration.")
        
    supabase: Client = create_client(url, key)

    # Generate a unique path: e.g., "1/random-uuid_handout.pdf"
    safe_filename = filename.replace(' ', '_')
    unique_filename = f"{user_id}/{uuid.uuid4()}_{safe_filename}"

    # Upload to the 'handouts' bucket
    supabase.storage.from_("handouts").upload(
        file=file_bytes,
        path=unique_filename,
        file_options={"content-type": "application/pdf"}
    )

    # Retrieve and return the public URL
    public_url = supabase.storage.from_("handouts").get_public_url(unique_filename)
    return public_url


def delete_pdf_from_supabase(file_url: str) -> None:
    """Extracts the file path from public URL and removes it from Supabase Storage."""
    if not file_url:
        return

    url = current_app.config.get("SUPABASE_URL")
    key = current_app.config.get("SUPABASE_KEY")
    
    if not url or not key:
        return

    try:
        supabase: Client = create_client(url, key)
        # Extract path relative to the 'handouts' bucket from full URL
        # e.g., '.../object/public/handouts/1/uuid_filename.pdf' -> '1/uuid_filename.pdf'
        path = file_url.split('/handouts/')[-1]
        supabase.storage.from_("handouts").remove([path])
    except Exception as e:
        print(f"Failed to delete file from Supabase: {e}")