# services/extractor.py
import os, pandas as pd
from docx import Document
import pdfplumber

class DocumentExtractor:
    @staticmethod
    def extract(file_path):
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".csv":
            return DocumentExtractor._extract_csv(file_path)
        elif ext == ".docx":
            return DocumentExtractor._extract_docx(file_path)
        elif ext == ".pdf":
            return DocumentExtractor._extract_pdf(file_path)
        else:
            return [{"type": "Unsupported", "content": "File type not supported"}]

    @staticmethod
    def _extract_csv(file_path):
        df = pd.read_csv(file_path)
        return [{"type": "row", "content": row.to_dict()} for _, row in df.iterrows()]

    @staticmethod
    def _extract_docx(file_path):
        doc = Document(file_path)
        return [{"type": para.style.name, "content": para.text}
                for para in doc.paragraphs if para.text.strip()]

    @staticmethod
    def _extract_pdf(file_path):
        data = []
        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text:
                    for line in text.split("\n"):
                        data.append({"page": i+1, "content": line})
        return data
