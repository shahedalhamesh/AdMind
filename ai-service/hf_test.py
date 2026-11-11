# hf_test.py — بيطبع الـ endpoints والحدود لأي Hugging Face Space
import os, sys
from dotenv import load_dotenv
from gradio_client import Client

load_dotenv()  # بيقرأ HF_TOKEN من .env
token = os.getenv("HF_TOKEN") or None
space = sys.argv[1] if len(sys.argv) > 1 else "kulkas2pintu/wan777"

print("Space:", space, "| token:", "موجود" if token else "غير موجود")


def connect(space, token):
    try:
        return Client(space, token=token)
    except TypeError:  # نسخ gradio_client القديمة
        return Client(space, hf_token=token)


try:
    client = connect(space, token)
    client.view_api()
except Exception as e:
    print("فشل الاتصال:", type(e).__name__, "-", e)