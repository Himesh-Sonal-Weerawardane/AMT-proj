import pdfplumber

def extract_pdf_text(file_path):
    data = []
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                for line in text.split("\n"):
                    data.append({"page": i+1, "content": line})
    return data
