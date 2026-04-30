from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import httpx
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    prompt: str

@app.options("/chat")
async def options_chat():
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.post("/chat")
async def chat(req: ChatRequest):
    api_key = os.environ.get("GROQ_API_KEY")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": req.prompt}],
                "temperature": 0.7,
                "max_tokens": 512
            }
        )

    data = response.json()
    print("Respuesta Groq:", data)

    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        text = data.get("error", {}).get("message", "Sin respuesta")

    return {"text": text}