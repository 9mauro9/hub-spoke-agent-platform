FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY spokes/housekeeper/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared code and spoke code
COPY shared/ /app/shared/
COPY config/ /app/config/
COPY spokes/housekeeper/app/ /app/spokes/housekeeper/app/

ENV PYTHONPATH=/app
ENV PORT=8080

EXPOSE 8080

CMD ["uvicorn", "spokes.housekeeper.app.main:worker", "--host", "0.0.0.0", "--port", "8080"]
