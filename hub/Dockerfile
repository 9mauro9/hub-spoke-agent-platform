FROM python:3.11-slim

WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install python packages
COPY hub/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared modules and hub code
COPY shared/ /app/shared/
COPY config/ /app/config/
COPY hub/app/ /app/hub/app/

ENV PYTHONPATH=/app
ENV PORT=8080

EXPOSE 8080

CMD ["uvicorn", "hub.app.main:app", "--host", "0.0.0.0", "--port", "8080"]
