from docx import Document

def extract_docx_text(file_path):
    doc = Document(file_path)
    data = []
    for para in doc.paragraphs:
        if para.text.strip():
            data.append({"type": para.style.name, "content": para.text})
    return data
