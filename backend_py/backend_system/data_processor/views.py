# views.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Module
from .services.extractor import DocumentExtractor
from .models import Comment

@csrf_exempt
def upload_module(request):
    if request.method == "POST" and request.FILES.get("file"):
        file = request.FILES["file"]
        module = Module.objects.create(title=file.name, file=file)

        # Extract text (CSV, DOCX, PDF, etc.)
        extracted = DocumentExtractor.extract(module.file.path)
        module.extracted_data = extracted
        module.save()

        return JsonResponse({
            "status": "success",
            "module_id": module.id,
            "extracted_data": extracted
        })
    return JsonResponse({"error": "No file uploaded"}, status=400)

@csrf_exempt
def add_comment(request, module_id):
    if request.method == "POST":
        text = request.POST.get("text")
        comment = Comment.objects.create(module_id=module_id, text=text)
        return JsonResponse({"status": "success", "comment_id": comment.id})
    return JsonResponse({"error": "Invalid request"}, status=400)