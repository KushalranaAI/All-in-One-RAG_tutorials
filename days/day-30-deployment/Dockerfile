FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt pyproject.toml ./
COPY rag_common ./rag_common
RUN pip install --no-cache-dir -r requirements.txt && pip install --no-cache-dir -e .
COPY . .
ENV PYTHONUNBUFFERED=1
EXPOSE 8000 8001
CMD ["uvicorn", "app:app", "--app-dir", "days/day-27-serving-api", "--host", "0.0.0.0", "--port", "8000"]
