FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY deckgen.py templatefill.py varfill.py workplan.py app.py template.pptx template_v1_1.potx template_v1_2.potx template_v1_3.potx ./
ENV PORT=8080
EXPOSE 8080
# gunicorn: 2 workers, 60s timeout is plenty for a 6-slide render
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 60 app:app"]
