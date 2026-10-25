FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# every module and template at the repo root: s3layout.py (template 1.5) and extract.py (/extract) were missing
# from the old explicit list, so a 1.5 render would fail on Render with "No module named 's3layout'" (Oct 25)
COPY *.py template.pptx template_v1_*.potx ./
COPY assets ./assets
ENV PORT=8080
EXPOSE 8080
# gunicorn: 2 workers, 60s timeout is plenty for a 6-slide render
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 60 app:app"]
