FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY spokes/video-ingest/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared core modules, configurations, and spoke application
COPY shared/ /app/shared/
COPY config/ /app/config/
COPY spokes/video-ingest/ /app/spokes/video_ingest/
RUN ln -s /app/spokes/video_ingest /app/spokes/video-ingest

ENV PYTHONPATH=/app
ENV PORT=8080
ENV GEMINI_MODEL=gemini-3.8-flash

# Autoscaling & Cloud Run Profile: min-instances=0, memory=2Gi, timeout=900s
EXPOSE 8080

CMD ["uvicorn", "spokes.video_ingest.app.main:app", "--host", "0.0.0.0", "--port", "8080"]

