import os
from dotenv import load_dotenv
from crewai import LLM

load_dotenv()
llm = LLM(
    model=os.getenv("MODEL"),
    api_key=os.getenv("GEMINI_API_KEY"),
    max_retries=5,
)
print(llm.call("Say hello in one sentence."))