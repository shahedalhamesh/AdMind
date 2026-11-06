import os
import sys

from dotenv import load_dotenv
from gradio_client import Client

load_dotenv()
Client(sys.argv[1], token=os.getenv("HF_TOKEN") or None).view_api()