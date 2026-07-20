# backend/database.py
import os
from supabase import create_client, Client

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

# Service key bypasses RLS — required for backend writes (see guide Section 11:
# "Supabase RLS policy violation" fix)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
